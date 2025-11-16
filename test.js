'use strict';
require('fs');
const logFile = '/tmp/strapi.log';

function writeLog(msg) {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`); 
}

/**
 * platform-user controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

/**
 * Parses the BrowserDataCombinationID string into a key-value object.
 * @param {string} str - The browser data combination string.
 * @returns {object} - An object with keys (e.g., 'screen_resolution') and their values.
 */
function parseBrowserData(str) {
  if (!str) return {};
  const params = new URLSearchParams(str);
  const data = {};
  for (const [key, value] of params.entries()) {
    data[key] = value;
  }
  return data;
}

// --- Weighted Matching Configuration ---

// Define the "weight" (importance) of each field.
// Higher numbers mean a field is more important for a match.
const weights = {
  screen_resolution: 5,
  cores: 5,
  gpu: 5,
  language: 2,
  useragent: 10,
  storage: 5,
  timezone: 2,
  webgl_hash: 5,    // High weight, good for fingerprinting
  canvas_hash: 5,   // High weight, good for fingerprinting
  spoofed_canvas: 10,// High weight, strong signal
  ip_data: 5,
  ram: 5,
  time: 1,           // Low weight, as this will almost always be different
};

// Calculate the maximum possible score
const maxScore = Object.values(weights).reduce((a, b) => a + b, 0);

// Define what percentage of the maxScore is needed to be considered a "match"
// This prevents very dissimilar users from being matched.
// 60% is a reasonable starting point, but you should tune this value.
const MATCH_THRESHOLD_PERCENTAGE = 0.6; // 60%
const MINIMUM_SCORE_THRESHOLD = maxScore * MATCH_THRESHOLD_PERCENTAGE;

/**
 * Calculates a match score between two browser data objects based on the defined weights.
 * @param {object} data1 - The first parsed browser data object.
 * @param {object} data2 - The second parsed browser data object.
 * @returns {number} - The calculated weighted score.
 */
function calculateMatchScore(data1, data2) {
  let score = 0;
  for (const key in weights) {
    // Check if both objects have the key and the values are identical
    if (data1.hasOwnProperty(key) && data2.hasOwnProperty(key) && data1[key] === data2[key]) {
      score += weights[key];
    }
  }
  return score;
}

// --- End of Weighted Matching Configuration ---

module.exports = createCoreController('api::platform-user.platform-user', ({ strapi }) => ({
  // POST /api/secure/platform-users/resolve
  async resolveBySecret(ctx) {
    const payload = ctx.request.body?.data || ctx.request.body || {};
    const { browserDataCombinationID } = payload;

    if (!browserDataCombinationID) {
      return ctx.badRequest('browserDataCombinationID is required.');
    }

    // --- 1. Attempt Perfect Match (Fast Path) ---
    // Server-side filter can use private fields
    const platformUser = await strapi.db
      .query('api::platform-user.platform-user')
      .findOne({ where: { BrowserDataCombinationID: browserDataCombinationID } });

    if (platformUser) {
      // Perfect match found, return immediately
      ctx.badRequest('test.')
      ctx.body = { FoundUser: true, Username: platformUser.Username };
      return;
    }

    // --- 2. No Perfect Match, Attempt Weighted Match (Slow Path) ---
    const allUsers = await strapi.db
      .query('api::platform-user.platform-user')
      .findMany({ select: ['id', 'Username', 'BrowserDataCombinationID'] }); // Only select needed fields

    if (!allUsers || allUsers.length === 0) {
      ctx.body = { FoundUser: false, Username: undefined };
      return;
    }

    // Parse the incoming search data
    const searchData = parseBrowserData(browserDataCombinationID);

    let bestMatch = null;
    let highestScore = 0;

    // Iterate through all users and find the one with the highest score
    for (const user of allUsers) {
      const userData = parseBrowserData(user.BrowserDataCombinationID);
      const score = calculateMatchScore(searchData, userData);

      if (score > highestScore) {
        highestScore = score;
        bestMatch = user;
      }
    }

    // Check if the best match found is "good enough" (i.e., above the threshold)
    if (bestMatch && highestScore >= MINIMUM_SCORE_THRESHOLD) {
      writeLog(`Weighted match found for ${bestMatch.Username} with score ${highestScore}/${maxScore}`);
      ctx.body = { FoundUser: true, Username: bestMatch.Username };
    } else {
      // No match was found, or the best match was below the threshold
      if (bestMatch) {
         writeLog(`Weighted match for ${bestMatch.Username} was below threshold (score ${highestScore}/${maxScore}). Rejecting.`);
      }
      ctx.body = { FoundUser: false, Username: undefined };
    }
  },

  // POST /api/secure/platform-users  (create with the private field)
  // This function is unchanged from your original.
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
      data: { Username, BrowserDataCombinationID, UserDataToDisplayToOthers, JoinedAtUnixTime }, // private field can be set here
    });

    ctx.body = { id: created.id, Username: created.Username }; // don’t return the secret
  },
}));
