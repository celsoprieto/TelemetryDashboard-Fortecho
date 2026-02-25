const msal = require('@azure/msal-node');

module.exports = async function (context, req) {

    const cca = new msal.ConfidentialClientApplication({
        auth: {
            clientId: process.env.EXTERNALID_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
            clientSecret: process.env.EXTERNALID_CLIENT_SECRET
        }
    });

    const tokenResponse = await cca.acquireTokenByCode({
        code: req.query.code,
        scopes: ["openid", "profile", "email"],
        redirectUri: process.env.REDIRECT_URI
    });

    context.res = {
        status: 302,
        headers: {
            "Set-Cookie": `auth_token=${tokenResponse.idToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
            "Location": "/"
        }
    };
};