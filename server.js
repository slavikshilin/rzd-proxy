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
    var token = null
    var authFlag = false

    var urlSegments = urlapi.parse(url)
    var isLogin = urlSegments.pathname && (urlSegments.pathname.search(/security_check/i) !== -1)
    var isLogout = urlSegments.pathname && (urlSegments.pathname.search(/security_logout/i) !== -1)

    if (isLogin) {
        token = crypto.randomBytes(64).toString('hex');
        tokenList.push( { token: token, data: cookieJar })
        console.log('Create token:' + token);      
        
        cookieJar.getCookies(url,function(err, cookieList) {       
            cookies = cookieList.join('; ')
            if (getCookie(cookies, 'AuthFlag')) {
                authFlag = JSON.parse(getCookieValue(cookies, 'AuthFlag'))
                console.log("AuthFlag=" + authFlag);
                if (!authFlag) {
                    data = {}
                }
            }
        });          

    } else if (isLogout) {
        // remove token from list
        var found = tokenList.find(function(item) { return item.data === cookieJar });
        if (found) {
            token = tokenList[tokenList.indexOf(found)].token
            tokenList.splice( tokenList.indexOf(found), 1 )
        }
    }

    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    });

    var response = (isLogin || isLogout) ? {data, authFlag, token } : { data }
    res.end(JSON.stringify(response));
}

function getRzdApiRequest(url, res) {

    console.log('Receive url:' + url)
    var cookieJar = new tough.CookieJar()    
    var urlSegments = urlapi.parse(url)
    var urlParams = urlSegments.query

    if (urlParams) {
        var params = querystring.parse(urlParams)
        console.log(params)
        if (params.token) {
            console.log('Token found: ' + params.token) 
            var found = tokenList.find(function(item) { return item.token === params.token });
            if (found) {
                console.log('Cookes for rzd: ' + found.data)
                cookieJar = found.data
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

var port = process.env.PORT || 4000

http.createServer(function (req, res) {
    var url = 'https://m.rzd.ru' + req.url;
    console.log(url);
    getRzdApiRequest(url, res)

}).listen(port);


console.log('Server running on port ' + port);
