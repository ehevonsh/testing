'use strict';

/**
 * platform-user controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::platform-user.platform-user', ({ strapi }) => ({
  // POST /api/secure/platform-users/resolve
  async resolveBySecret(ctx) {
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const { browserDataCombinationID } = payload;

    if (!browserDataCombinationID) {
      return ctx.badRequest('browserDataCombinationID is required.');
    }

    // --- 1. Call the centralized service to find the user ---
    const platformUser = await strapi
      .service('api::platform-user.platform-user')
      .findUserByBestMatch(browserDataCombinationID);

    // --- 2. Handle the result ---
    if (platformUser) {
      // Match found (either perfect or weighted)
      ctx.body = { FoundUser: true, Username: platformUser.Username, UserDataToDisplayToOthers: platformUser.UserDataToDisplayToOthers };
    } else {
      // No match found
      ctx.body = { FoundUser: false, Username: undefined };
    }
  },

  // POST /api/secure/platform-users  (create with the private field)
  // This function is unchanged.
  async createWithSecret(ctx) {
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const {
      Username,
      BrowserDataCombinationID,
      UserDataToDisplayToOthers,
      JoinedAtUnixTime,
    } = payload;

    if (!Username || !BrowserDataCombinationID || !UserDataToDisplayToOthers || !JoinedAtUnixTime) return ctx.badRequest('Missing fields');

    const created = await strapi.entityService.create('api::platform-user.platform-user', {
      data: { Username, BrowserDataCombinationID, UserDataToDisplayToOthers, JoinedAtUnixTime },
    });

    ctx.body = { id: created.id, Username: created.Username };
  },
}));
