/*
#######################################################################
#
# Copyright (C) 2022-2024 David C. Harrison. All right reserved.
#
# You may not use, distribute, publish, or modify this code without
# the express written permission of the copyright holder.
#
*/
const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const express = require('express');

require('dotenv').config();
const app = require('../../backend/src/app');

let backend;
let frontend;
let browser;
let page;

/**
 * Start an API server on port 3010 connected to the DEV database
 * Start a Web server for the built ("comliled") version of the UI
 * on port 3000.
 */
beforeAll(() => {
  backend = http.createServer(app);
  backend.listen(3010, () => {
    console.log('Backend Running at http://localhost:3010');
  });
  frontend = http.createServer(
    express()
      .use('/assets', express.static(
        path.join(__dirname, '..', '..', 'frontend', 'dist', 'assets')))
      .get('*', function(req, res) {
        res.sendFile('index.html',
          {root: path.join(__dirname, '..', '..', 'frontend', 'dist')});
      }),
  );
  frontend.listen(3000, () => {
    console.log('Frontend Running at http://localhost:3000');
  });
});

/**
 * Shotdown the API server then the Web server.
 */
afterAll((done) => {
  backend.close(() => {
    frontend.close(done);
  });
});

/**
 * Create a headless (not visible) instance of Chrome for each test
 * and open a new page (tab).
 */
beforeEach(async () => {
  browser = await puppeteer.launch({
    headless: true,
  });
  page = await browser.newPage();
  page.on('console', (msg) => {
    console.log('Browser log:', msg.text());
  });
  await page.setViewport({
    width: 1080,
    height: 780,
  });
});

/**
 * Close the headless instance of Chrome as we no longer need it.
 */
afterEach(async () => {
  await browser.close();
});

/**
 * createGoal
 * @param {string} title
 * @param {string} description
 * @param {number} arrowsDownOnRecurrence
 * @return {Promise<void>}
 */
async function createGoal(title, description, arrowsDownOnRecurrence) {
  // https://chat.openai.com/share/67880247-ed5d-4614-af95-1b17ae8a6d05
  await page.goto('http://localhost:3000/createGoal');

  const titleInput = await page
    .waitForSelector('input[id="title"]');
  await titleInput.type(title);

  const descriptionInput = await page
    .waitForSelector('textarea[id="description"]');
  await descriptionInput.type(description);

  await page.waitForSelector('#recurrence');
  await page.click('#recurrence');
  for (let i = 0; i < arrowsDownOnRecurrence; i++) {
    await page.keyboard.press('ArrowDown'); // Move down in the dropdown
  }
  await page.keyboard.press('Enter'); // Select the option

  await page.waitForSelector('#tag'); //timesout atm
  await page.click('#tag');
  for (let i = 0; i < arrowsDownOnRecurrence; i++) {
    await page.keyboard.press('ArrowDown'); //Using same var as recurrence because of similar format
  }
  await page.keyboard.press('Enter'); // Select the option
  
  await page.$eval(`[type="submit"]`, (element) =>
    element.click(),
  );
  await page.waitForNavigation();
}

test('Create goal', async () => {
  await createGoal('GoalTitle', 'GoalDescription', 2);
});

/**
 * clickFirstGoal
 * @return {Promise<void>}
 */
async function clickFirstGoal() {
  await page.waitForSelector('[aria-label^="goal-link-"]');

  await page.evaluate(() => {
    const goalLink = document.querySelector('[aria-label^="goal-link-"]');
    if (goalLink) {
      goalLink.click();
    }
  });
}

/**
 * expectViewGoalPageContents
 * @return {Promise<void>}
 */
async function expectViewGoalPageContents() {
  await page.waitForSelector('[aria-label^="goal-title-"]');
  const goalTitle = await page.evaluate(() => {
    const goalLink = document.querySelector('[aria-label^="goal-title-"]');
    return goalLink.innerText; // or any other property you want to retrieve
  });
  expect(goalTitle).toBeDefined();
}

/**
 * typeIntoSearchAndExpectFilter
 * @return {Promise<void>}
 */
async function typeIntoSearchAndExpectFilter() {
  // wait for goals to appear
  await page.waitForFunction(() => {
    const elements = document.querySelectorAll(`[aria-label^="goal-link-"]`);
    return elements.length >= 5;
  }, {});
  const searchInput = await page
    .waitForSelector('input[id="search-filter-goals"]');
  await searchInput.type('GoalTitle1');

  // wait for goals to appear post filter
  // i don't know why this is needed to pass the test
  await page.waitForFunction(() => {
    const elements = document.querySelectorAll(`[aria-label^="goal-link-"]`);
    return elements.length >= 5;
  }, {});

  // wait for selected goals to appear
  await page.waitForFunction((label, count) => {
    const elements = document.querySelectorAll(`[aria-label^="goal-link-"]`);
    let matchedCount = 0;
    elements.forEach((element) => {
      if (element.textContent.includes(label)) {
        matchedCount++;
      }
    });
    return matchedCount >= count;
  }, {}, 'GoalTitle1', 5);
}

test('Index page for goal', async () => {
  // Create sample goal data
  for (let i = 20; i <= 1; i++) {
    await createGoal('GoalTitle' + i, 'GoalDescription' + i, i);
  }
  await page.goto('http://localhost:3000/goals');
  await clickFirstGoal();
  await expectViewGoalPageContents();
});

test('Filtering goals by search', async () => {
  // Create sample goal data
  for (let i = 1; i <= 20; i++) {
    await createGoal('GoalTitle' + i, 'GoalDescription' + i, i);
  }
  await page.goto('http://localhost:3000/goals');
  await typeIntoSearchAndExpectFilter();
}, 15000);
