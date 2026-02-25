module.exports = async function (context) {
    context.res = {
        status: 302,
        headers: {
            "Set-Cookie": "auth_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
            "Location": "/"
        }
    };
};