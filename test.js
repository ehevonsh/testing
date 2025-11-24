'use strict';

/**
 * platform-user service
 */

const { createCoreService } = require('@strapi/strapi').factories;

// --- Weighted Matching Configuration ---
// All helper functions and constants are moved here

/**
 * Parses the BrowserDataCombinationID string into a key-value object.
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

const weights = {
  screen_resolution: 5,
  cores: 10,
  gpu: 10,
  language: 3,
  useragent: 10,
  storage: 1,
  timezone: 2,
  device_type: 2,
  webgl_hash: 3,
  canvas_hash: 10,
  spoofed_canvas: 10,
  ip_data: 5,
  ram: 1,
  time: 0,
};

const maxScore = Object.values(weights).reduce((a, b) => a + b, 0);
const MATCH_THRESHOLD_PERCENTAGE = 0.7; // 70%
const MINIMUM_SCORE_THRESHOLD = maxScore * MATCH_THRESHOLD_PERCENTAGE;

/**
 * Calculates a match score between two browser data objects.
 */
function calculateMatchScore(data1, data2) {
  let score = 0;
  for (const key in weights) {
    if (data1.hasOwnProperty(key) && data2.hasOwnProperty(key) && data1[key] === data2[key]) {
      score += weights[key];
    }
  }
  return score;
}

// --- End of Weighted Matching Configuration ---


module.exports = createCoreService('api::platform-user.platform-user', ({ strapi }) => ({

  /**
   * Finds a platform-user by their browserDataCombinationID, using a weighted
   * matching algorithm if a perfect match isn't found.
   * @param {string} browserDataCombinationID - The ID string from the user.
   * @returns {object|null} - The found platformUser entity, or null if no match.
   */
  async findUserByBestMatch(browserDataCombinationID) {
    if (!browserDataCombinationID) return null;

    // --- 1. Attempt Perfect Match (Fast Path) ---
    const perfectMatch = await strapi.db
      .query('api::platform-user.platform-user')
      .findOne({ where: { BrowserDataCombinationID: browserDataCombinationID } });

    if (perfectMatch) {
      // Perfect match found, return immediately
      return perfectMatch;
    }

    // --- 2. No Perfect Match, Attempt Weighted Match (Slow Path) ---
    const allUsers = await strapi.db
      .query('api::platform-user.platform-user')
      .findMany({ select: ['id', 'Username', 'BrowserDataCombinationID', "UserDataToDisplayToOthers"] });

    if (!allUsers || allUsers.length === 0) {
      return null;
    }

    const searchData = parseBrowserData(browserDataCombinationID);
    let bestMatch = null;
    let highestScore = 0;

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
      console.log(`Weighted match found for ${bestMatch.Username} with score ${highestScore}/${maxScore}`);
      return bestMatch;
    }

    // No match was found, or the best match was below the threshold
    if (bestMatch) {
       console.log(`Weighted match for ${bestMatch.Username} was below threshold (score ${highestScore}/${maxScore}). Rejecting.`);
    }
    
    return null;
  }
}));
