const {promises: {writeFile, mkdir}, existsSync} = require('fs');
const puppeteer = require('puppeteer');

function sleep(duration) {
  return new Promise(resolve => {
    setTimeout(resolve, duration * 1000);
  });
}

(async () => {
  if (!existsSync('tmp')) {
    await mkdir('tmp');
  }
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const session = await page.target().createCDPSession();

  await session.send('DOM.enable');
  await session.send('CSS.enable');
  await session.send('Page.enable');

  await session.on('Page.domContentEventFired', (...args) => {
    console.log('dom event: ', args);
  });
  await session.on('Page.lifecycleEvent', (...args) => {
    console.log('lifecycle event: ', args);
  });
  await session.on('Page.loadEventFired', async (...args) => {
    console.log('load event: ', args);

    const {root} = await session.send('DOM.getDocument', {
      depth: -1,
    });

    const {nodeId} = root;
    const {nodeIds} = await session.send('DOM.querySelectorAll', {
      nodeId,
      selector: 'h1',
    });
    console.log('H1: ', nodeIds);

    let promises = nodeIds.map(async nodeId => {
      const html = await session.send('DOM.getOuterHTML', {
        nodeId,
      });
      console.log(`Node ID ${nodeId}: `, html);

      const result = await session.send('CSS.getMatchedStylesForNode', {
        nodeId,
      });
      const {matchedCSSRules} = result;
      await writeFile(`tmp/${nodeId}.json`, JSON.stringify(matchedCSSRules, null, '  '), 'utf8');
    });
    await Promise.all(promises);

    const {data} = await session.send('Page.captureScreenshot');
    await writeFile(`tmp/1.png`, data, 'base64');
  });

  await session.send('Page.navigate', {
    url: 'https://openresty.com.cn/cn/',
  });

  //const screenshot = await session.send('Page.captureScreenshot');
  //await writeFile('tmp/1.png', screenshot, 'base64');

  await sleep(10);

  console.log('done.');
  browser.close();
})();

