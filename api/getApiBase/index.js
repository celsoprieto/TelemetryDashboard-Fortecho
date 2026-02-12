module.exports = async function (context, req) {
  // Read environment variable on the server side
  const apiBase = process.env.FUNCTIONS_BASE || "default_value_if_missing";

  context.res = {
    // Return JSON to the client
    headers: { "Content-Type": "application/json" },
    body: { apiBase }
  };
};
