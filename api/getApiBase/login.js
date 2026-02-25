// login.js
const msal = require('@azure/msal-node');

module.exports = async function (context, req) {
    const config = {
        auth: {
            clientId: process.env.EXTERNALID_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`, // tenant de External ID
            clientSecret: process.env.EXTERNALID_CLIENT_SECRET
        }
    };

    const cca = new msal.ConfidentialClientApplication(config);

    const authUrl = await cca.getAuthCodeUrl({
        scopes: ["openid", "profile", "email"],
        redirectUri: process.env.REDIRECT_URI
    });

    // Redirige al usuario al login de External ID
    context.res = {
        status: 302,
        headers: { Location: authUrl }
    };
};