const WebSocket = require('ws');
const puppeteer = require('puppeteer');
const SEND = require('./SEND');

(async () => {
  // Launch a headful browser so that we can see the page navigating.
  const browser = await puppeteer.launch({headless: false});

  // Create a websocket to issue CDP commands.
  const ws = new WebSocket(browser.wsEndpoint(), {perMessageDeflate: false});
  await new Promise(resolve => ws.once('open', resolve));

  // Get list of all targets and find a "page" target.
  const targetsResponse = await SEND(ws, {
    id: 1,
    method: 'Target.getTargets',
  });
  const pageTarget = targetsResponse.result.targetInfos.find(info => info.type === 'page');

  // Attach to the page target.
  let response = await SEND(ws, {
    id: 2,
    method: 'Target.attachToTarget',
    params: {
      targetId: pageTarget.targetId,
      flatten: true,
    },
  });
  const sessionId = response.result.sessionId;

  // Navigate the page using the session.
  await SEND(ws, {
    sessionId,
    id: 3, // Note that IDs are independent between sessions.
    method: 'Page.navigate',
    params: {
      url: 'https://openresty.com.cn/cn/',
    },
  });

  const {result: {root}} = await SEND(ws, {
    sessionId,
    id: 4,
    method: 'DOM.getDocument',
    params: {
      depth: 10,
    },
  });

  const {nodeId} = root;
  const {result: {nodeIds}} = await SEND(ws, {
    sessionId,
    id: 5,
    method: 'DOM.querySelectorAll',
    params: {
      nodeId,
      selector: 'h1',
    },
  });
  console.log('H1: ', nodeIds);

  let promises = nodeIds.map(async (nodeId, index) => {
    const html = await SEND(ws, {
      sessionId,
      id: 6 + index,
      method: 'DOM.getOuterHTML',
      params: {
        nodeId,
      },
    });
    console.log(`Node ID ${nodeId}: `, html);
  });

  await Promise.all(promises);

  promises = nodeIds.map(async (nodeId, index) => {
    const result = await SEND(ws, {
      sessionId,
      id: 8 + index,
      method: 'CSS.getMatchedStylesForNode',
      params: {
        nodeId,
      },
    });
    console.log(`Node ID ${nodeId}: `, result);
  });

  await Promise.all(promises);
})();

