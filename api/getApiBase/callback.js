// callback.js
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

    // Envía token al SPA (puede ser en JSON, cookie segura o header)
    context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
            id_token: tokenResponse.idToken,
            access_token: tokenResponse.accessToken,
            expires_in: tokenResponse.expiresOn
        }
    };
};