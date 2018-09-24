const axios = require('axios')
const crypto = require('crypto')
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')
var http = require('http')
var urlapi = require('url')
const querystring = require('querystring')

axiosCookieJarSupport(axios)

var tokenList = []

function getCookieValue(cookies, sKey) {
    if (!sKey) { return null }
    return decodeURIComponent(cookies.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
}

// возвращает cookie с именем name, если есть, если нет, то undefined
function getCookie(cookies, name) {
    var matches = cookies.match(new RegExp(
      "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

function getJsonResponse(res, data, url, cookieJar) {
    var cookies = ''
    var authInfo = null
    var token = null
    var authFlag = false

    // remove token from list
    if (Object.keys(data).length === 0) {
        var found = tokenList.find(function(item) { return item.data === cookieJar });
        if (found) {
            tokenList.splice( tokenList.indexOf(found), 1 );
        }
    }

    cookieJar.getCookies(url,function(err, cookieList) {       
        cookies = cookieList.join('; ')
        if (getCookie(cookies, 'AuthFlag')) {
            authFlag = JSON.parse(getCookieValue(cookies, 'AuthFlag'))
            console.log("AuthFlag=" + authFlag);
            if (!authFlag) {
                data = {}
            } else {
                token = crypto.randomBytes(64).toString('hex');
                tokenList.push( { token: token, data: cookieJar })
                console.log(token);                
            }
            authInfo = { authFlag: authFlag }
        }

      });    

    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Set-Cookie': cookies
    });

    var response = authInfo ? {data, authFlag, token } : { data }
    res.end(JSON.stringify(response));
}

function getRzdApiRequest(url, res) {

    var cookieJar = new tough.CookieJar()    

    var urlSegments = urlapi.parse(url)
    var urlParams = urlSegments.query
    console.log(urlParams)
    if (urlParams) {
        var params = querystring.parse(urlParams)
        console.log(params)
        if (params.token) {
            console.log('token found: ' + params.token) 

            var found = tokenList.find(function(item) { return item.token === params.token });
            if (found) {
                console.log('Cookes for rzd: ' + found.data)
                cookieJar = found.data
                /*
                cookieJar.setCookie(found.data, url, (err, cookie) => {
                    if(err) {
                        reject(new Error(err));
                        return;
                    }
                })
                */
            }
        }
    }

    axios.get(url, {
        jar: cookieJar, // tough.CookieJar or boolean
        withCredentials: true // If true, send cookie stored in jar
    })
    .then(response => {
        getJsonResponse(res, response.data, url, cookieJar)
    })
    .catch(error => {
        getJsonResponse(res, { error: error.message, status: error.response.status, statusText: error.response.statusText }, url, cookieJar)                                   
        //console.log(error);
    });
}

http.createServer(function (req, res) {
    var url = 'https://m.rzd.ru' + req.url;
    console.log(url);
    getRzdApiRequest(url, res)

}).listen(process.env.PORT || 4000);


console.log('Server running');
