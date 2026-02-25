const msal = require('@azure/msal-node');

module.exports = async function (context) {

    const cca = new msal.ConfidentialClientApplication({
        auth: {
            clientId: process.env.EXTERNALID_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
            clientSecret: process.env.EXTERNALID_CLIENT_SECRET
        }
    });

    const authUrl = await cca.getAuthCodeUrl({
        scopes: ["openid", "profile", "email"],
        redirectUri: process.env.REDIRECT_URI
    });

    context.res = {
        status: 302,
        headers: { Location: authUrl }
    };
};