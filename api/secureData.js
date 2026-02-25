const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`
});

function getKey(header, callback){
    client.getSigningKey(header.kid, function(err, key) {
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

module.exports = async function (context, req) {

    const token = req.headers.cookie
        ?.split('; ')
        .find(c => c.startsWith('auth_token='))
        ?.split('=')[1];

    if (!token) {
        context.res = { status: 401 };
        return;
    }

    jwt.verify(token, getKey, {
        audience: process.env.EXTERNALID_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`
    }, function(err, decoded) {

        if (err) {
            context.res = { status: 401 };
            return;
        }

        context.res = {
            status: 200,
            body: { message: "Acceso permitido", user: decoded }
        };
    });
};