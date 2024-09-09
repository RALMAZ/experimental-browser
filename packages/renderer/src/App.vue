<script setup>
import { ref, onMounted, nextTick } from 'vue';
import uniqid from 'uniqid';
import { debounce } from 'throttle-debounce';
import ChromeTabs from './utils/chrome-tabs.js';

const loading = ref(true);
const tabs = ref([]);

const chromeTabs = new ChromeTabs();

async function addTab(
  url = 'https://google.com',
  title = 'Loading..',
) {
  let tab = {
    id: uniqid(),

    active: true,

    url,
    title,
    favicon: false,

    canGoForward: false,
    canGoBack: false,

    abortController: new AbortController(),
  };

  chromeTabs.addTab(tab);

  tabs.value = tabs.value.map(t => {
    return {
      ...t,
      active: false,
    };
  });

  tabs.value.push(tab);

  await nextTick();

  let webviewElm = document.getElementById(`webview-${tab.id}`);

  if (webviewElm) {
    const { signal } = tab.abortController;

    webviewElm.addEventListener('page-title-updated', ({ title }) => {
      let activeElm = tabs.value.find(t => t.id === tab.id);

      activeElm.title = title;

      activeElm.canGoForward = webviewElm.canGoForward();
      activeElm.canGoBack = webviewElm.canGoBack();

      chromeTabs.updateTabOutside(tab.id, {
        title,
      });
    }, { signal });

    webviewElm.addEventListener('page-favicon-updated', ({ favicons }) => {
      let newFavicon = favicons && favicons.length > 0 ? favicons[0] : false;

      let activeElm = tabs.value.find(t => t.id === tab.id);

      activeElm.favicon = newFavicon;

      activeElm.canGoForward = webviewElm.canGoForward();
      activeElm.canGoBack = webviewElm.canGoBack();

      chromeTabs.updateTabOutside(tab.id, {
        favicon: newFavicon,
      });
    }, { signal });

    webviewElm.addEventListener('did-navigate-in-page', (event) => {
      let activeElm = tabs.value.find(t => t.id === tab.id);

      activeElm.url = event.url;
      
      activeElm.canGoForward = webviewElm.canGoForward();
      activeElm.canGoBack = webviewElm.canGoBack();
    }, { signal });

    webviewElm.addEventListener('will-navigate', (event) => {
      event.preventDefault();

      webviewElm.loadURL(event.url);
    }, { signal });

    webviewElm.addEventListener('new-window', (event) => {
      event.preventDefault();

      webviewElm.loadURL(event.url);
    }, { signal });
  }
}

function applyUrlChange(payload, id) {
  // Validate url to open it or transform into Google search request instead
  let checkUrl = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;

  let url = String(payload).trim();

  let activeElm = tabs.value.find(t => t.id === id);
  let webviewElm = document.getElementById(`webview-${activeElm.id}`);

  let isValid = url.match(checkUrl);

  if (isValid) {
    // Crutch for prevening Electron behaviour to non-http links like "google.com" instead "https://google.com"
    let isHttpIncluded = String(url).search('https://') > -1 || String(url).search('http://') > -1;

    if (isHttpIncluded) {
      webviewElm.loadURL(url);
    } else {
      webviewElm.loadURL(`https://${url}`);
    }
  } else {
    url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;

    webviewElm.loadURL(url);
  }
}

const processUrlChange = debounce(600, (e, id) => {
  let payload = e.target.innerText;

	applyUrlChange(payload, id);
});

function processHistory(id, payload) {
  let activeElm = tabs.value.find(t => t.id === id);
  let webviewElm = document.getElementById(`webview-${activeElm.id}`);

  if (payload > 0) {
    webviewElm.goForward();
  } else {
    webviewElm.goBack();
  }
}

function handleReload(id) {
  let activeElm = tabs.value.find(t => t.id === id);
  let webviewElm = document.getElementById(`webview-${activeElm.id}`);

  webviewElm.reload();
}

onMounted(() => {
  const el = document.querySelector('.chrome-tabs');

  chromeTabs.init(el);

  el.addEventListener('activeTabChange', ({ detail }) => {
    try {
      let id = detail.tabEl.dataset.tabId;

      tabs.value = tabs.value.map(t => {
        return {
          ...t,
          active: false,
        };
      });

      let findNextActive = tabs.value.find(t => t.id === id);

      if (findNextActive) {
        findNextActive.active = true;
      }
    } catch (error) {
      console.error(error);
    }
  });

  el.addEventListener('tabRemove', ({ detail }) => {
    // @TODO remove listeners

    try {
      let id = detail.tabEl.dataset.tabId;

      let activeElm = tabs.value.find(t => t.id === id);

      activeElm.abortController.abort();

      tabs.value = tabs.value.filter(t => t.id !== id);

      let isAnyActive = tabs.value.find(t => t.active);

      if (!isAnyActive && tabs.value.length > 0) {
        tabs.value[0].active = true;
      }
    } catch (error) {
      console.error(error);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 't') {
      addTab();
    }
  });

  addTab();

  loading.value = false;
});
</script>

<template>
  <div class="chrome-tabs" style="--tab-content-margin: 9px">
    <div class="chrome-tabs-content"></div>

    <div class="chrome-tabs-bottom-bar"></div>
  </div>

  <div class="chrome-tabs-optional-shadow-below-bottom-bar"></div>

  <div
    v-for="(tab, id) in tabs"
    :key="id"
    class="mock-browser-content"
  >
    <div
      v-show="tab.active"
      class="toolbar"
      >
      <div class="controls">
        <svg
          width="30px"
          height="30px"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          stroke-width="3"
          fill="none"
          :stroke="tab.canGoBack ? '#000000' : 'lightgray'"
          @click="tab.canGoBack ? processHistory(tab.id, -1) : false"
        >
          <line x1="10.33" y1="32.63" x2="55.78" y2="32.63"/><polyline points="27.56 14.63 10.34 32.79 27.56 49.32"/>
        </svg>

        <svg
          width="30px"
          height="30px"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          stroke-width="3"
          fill="none"
          :stroke="tab.canGoForward ? '#000000' : 'lightgray'"
          @click="tab.canGoForward ? processHistory(tab.id, 1) : false"
        >
          <line x1="55.78" y1="32.63" x2="10.33" y2="32.63"/><polyline points="38.55 14.63 55.78 32.79 38.55 49.32"/>
        </svg>

        <svg
          width="30px"
          height="30px"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          @click="handleReload(tab.id)"
        >
          <rect width="24" height="24" fill="white"/>
          <path d="M21.3687 13.5827C21.4144 13.3104 21.2306 13.0526 20.9583 13.0069C20.686 12.9612 20.4281 13.1449 20.3825 13.4173L21.3687 13.5827ZM12 20.5C7.30558 20.5 3.5 16.6944 3.5 12H2.5C2.5 17.2467 6.75329 21.5 12 21.5V20.5ZM3.5 12C3.5 7.30558 7.30558 3.5 12 3.5V2.5C6.75329 2.5 2.5 6.75329 2.5 12H3.5ZM12 3.5C15.3367 3.5 18.2252 5.4225 19.6167 8.22252L20.5122 7.77748C18.9583 4.65062 15.7308 2.5 12 2.5V3.5ZM20.3825 13.4173C19.7081 17.437 16.2112 20.5 12 20.5V21.5C16.7077 21.5 20.6148 18.0762 21.3687 13.5827L20.3825 13.4173Z" fill="#000000"/>
          <path d="M20.4716 2.42157V8.07843H14.8147" stroke="#000000" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        <svg
          fill="#000000"
          width="30px"
          height="30px"
          viewBox="0 0 1920 1920"
          xmlns="http://www.w3.org/2000/svg"
          @click="addTab()"
        >
          <path d="M915.744 213v702.744H213v87.842h702.744v702.744h87.842v-702.744h702.744v-87.842h-702.744V213z" fill-rule="evenodd"/>
        </svg>
      </div>
      <div class="url">
        <div
          class="text"
          contenteditable
          @keypress="(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();

              let payload = e.target.innerText;

              applyUrlChange(payload, tab.id);
            }
          }"
        >
          {{ tab.url }}
        </div>
      </div>
    </div>

    <div v-show="tab.active">
      <webview
        v-if="tab.url"
        :id="`webview-${tab.id}`"
        :src="tab.url"
        allowpopups
        class="ra-webview"
      ></webview>
    </div>
  </div>
</template>

<style>
  .chrome-tabs {
    box-sizing: border-box;
    position: relative;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    font-size: 12px;
    height: 46px;
    padding: 8px 3px 4px 3px;
    background: #dee1e6;
    border-radius: 5px 5px 0 0;
    overflow: hidden;
  }
  .chrome-tabs * {
    box-sizing: inherit;
    font: inherit;
  }
  .chrome-tabs .chrome-tabs-content {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .chrome-tabs .chrome-tab {
    position: absolute;
    left: 0;
    height: 36px;
    width: 240px;
    border: 0;
    margin: 0;
    z-index: 1;
    pointer-events: none;
  }
  .chrome-tabs .chrome-tab,
  .chrome-tabs .chrome-tab * {
    user-select: none;
    cursor: default;
  }
  .chrome-tabs .chrome-tab .chrome-tab-dividers {
    position: absolute;
    top: 7px;
    bottom: 7px;
    left: var(--tab-content-margin);
    right: var(--tab-content-margin);
  }
  .chrome-tabs .chrome-tab .chrome-tab-dividers,
  .chrome-tabs .chrome-tab .chrome-tab-dividers::before,
  .chrome-tabs .chrome-tab .chrome-tab-dividers::after {
    pointer-events: none;
  }
  .chrome-tabs .chrome-tab .chrome-tab-dividers::before,
  .chrome-tabs .chrome-tab .chrome-tab-dividers::after {
    content: "";
    display: block;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #a9adb0;
    opacity: 1;
    transition: opacity 0.2s ease;
  }
  .chrome-tabs .chrome-tab .chrome-tab-dividers::before {
    left: 0;
  }
  .chrome-tabs .chrome-tab .chrome-tab-dividers::after {
    right: 0;
  }
  .chrome-tabs .chrome-tab:first-child .chrome-tab-dividers::before,
  .chrome-tabs .chrome-tab:last-child .chrome-tab-dividers::after {
    opacity: 0;
  }
  .chrome-tabs .chrome-tab .chrome-tab-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
  }
  .chrome-tabs .chrome-tab .chrome-tab-background > svg {
    width: 100%;
    height: 100%;
  }
  .chrome-tabs .chrome-tab .chrome-tab-background > svg .chrome-tab-geometry {
    fill: #f4f5f6;
  }
  .chrome-tabs .chrome-tab[active] {
    z-index: 5;
  }
  .chrome-tabs .chrome-tab[active] .chrome-tab-background > svg .chrome-tab-geometry {
    fill: #fff;
  }
  .chrome-tabs .chrome-tab:not([active]) .chrome-tab-background {
    transition: opacity 0.2s ease;
    opacity: 0;
  }
  @media (hover: hover) {
    .chrome-tabs .chrome-tab:not([active]):hover {
      z-index: 2;
    }
    .chrome-tabs .chrome-tab:not([active]):hover .chrome-tab-background {
      opacity: 1;
    }
  }
  .chrome-tabs .chrome-tab.chrome-tab-was-just-added {
    top: 10px;
    animation: chrome-tab-was-just-added 120ms forwards ease-in-out;
  }
  .chrome-tabs .chrome-tab .chrome-tab-content {
    position: absolute;
    display: flex;
    top: 0;
    bottom: 0;
    left: var(--tab-content-margin);
    right: var(--tab-content-margin);
    padding: 9px 8px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    overflow: hidden;
    pointer-events: all;
  }
  .chrome-tabs .chrome-tab[is-mini] .chrome-tab-content {
    padding-left: 2px;
    padding-right: 2px;
  }
  .chrome-tabs .chrome-tab .chrome-tab-favicon {
    position: relative;
    flex-shrink: 0;
    flex-grow: 0;
    height: 16px;
    width: 16px;
    background-size: 16px;
    margin-left: 4px;
  }
  .chrome-tabs .chrome-tab[is-small] .chrome-tab-favicon {
    margin-left: 0;
  }
  .chrome-tabs .chrome-tab[is-mini]:not([active]) .chrome-tab-favicon {
    margin-left: auto;
    margin-right: auto;
  }
  .chrome-tabs .chrome-tab[is-mini][active] .chrome-tab-favicon {
    display: none;
  }
  .chrome-tabs .chrome-tab .chrome-tab-title {
    flex: 1;
    vertical-align: top;
    overflow: hidden;
    white-space: nowrap;
    margin-left: 4px;
    color: #5f6368;
    -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 calc(100% - 24px), transparent);
    mask-image: linear-gradient(90deg, #000 0%, #000 calc(100% - 24px), transparent);
  }
  .chrome-tabs .chrome-tab[is-small] .chrome-tab-title {
    margin-left: 0;
  }
  .chrome-tabs .chrome-tab .chrome-tab-favicon + .chrome-tab-title,
  .chrome-tabs .chrome-tab[is-small] .chrome-tab-favicon + .chrome-tab-title {
    margin-left: 8px;
  }
  .chrome-tabs .chrome-tab[is-smaller] .chrome-tab-favicon + .chrome-tab-title,
  .chrome-tabs .chrome-tab[is-mini] .chrome-tab-title {
    display: none;
  }
  .chrome-tabs .chrome-tab[active] .chrome-tab-title {
    color: #45474a;
  }
  .chrome-tabs .chrome-tab .chrome-tab-drag-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }
  .chrome-tabs .chrome-tab .chrome-tab-close {
    flex-grow: 0;
    flex-shrink: 0;
    position: relative;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><path stroke='rgba(0, 0, 0, .65)' stroke-linecap='square' stroke-width='1.5' d='M0 0 L8 8 M8 0 L0 8'></path></svg>");
    background-position: center center;
    background-repeat: no-repeat;
    background-size: 8px 8px;
  }
  @media (hover: hover) {
    .chrome-tabs .chrome-tab .chrome-tab-close:hover {
      background-color: #e8eaed;
    }
    .chrome-tabs .chrome-tab .chrome-tab-close:hover:active {
      background-color: #dadce0;
    }
  }
  @media not all and (hover: hover) {
    .chrome-tabs .chrome-tab .chrome-tab-close:active {
      background-color: #dadce0;
    }
  }
  @media (hover: hover) {
    .chrome-tabs .chrome-tab:not([active]) .chrome-tab-close:not(:hover):not(:active) {
      opacity: 0.8;
    }
  }
  .chrome-tabs .chrome-tab[is-smaller] .chrome-tab-close {
    margin-left: auto;
  }
  .chrome-tabs .chrome-tab[is-mini]:not([active]) .chrome-tab-close {
    display: none;
  }
  .chrome-tabs .chrome-tab[is-mini][active] .chrome-tab-close {
    margin-left: auto;
    margin-right: auto;
  }
  @-moz-keyframes chrome-tab-was-just-added {
    to {
      top: 0;
    }
  }
  @-webkit-keyframes chrome-tab-was-just-added {
    to {
      top: 0;
    }
  }
  @-o-keyframes chrome-tab-was-just-added {
    to {
      top: 0;
    }
  }
  @keyframes chrome-tab-was-just-added {
    to {
      top: 0;
    }
  }
  .chrome-tabs.chrome-tabs-is-sorting .chrome-tab:not(.chrome-tab-is-dragging),
  .chrome-tabs:not(.chrome-tabs-is-sorting) .chrome-tab.chrome-tab-was-just-dragged {
    transition: transform 120ms ease-in-out;
  }
  .chrome-tabs .chrome-tabs-bottom-bar {
    position: absolute;
    bottom: 0;
    height: 4px;
    left: 0;
    width: 100%;
    background: #fff;
    z-index: 10;
  }
  .chrome-tabs-optional-shadow-below-bottom-bar {
    position: relative;
    height: 1px;
    width: 100%;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1' viewBox='0 0 1 1'><rect x='0' y='0' width='1' height='1' fill='rgba(0, 0, 0, .17)'></rect></svg>");
    background-size: 1px 1px;
    background-repeat: repeat-x;
    background-position: 0% 0%;
  }
  @media only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (min--moz-device-pixel-ratio: 2), only screen and (-o-min-device-pixel-ratio: 2/1), only screen and (min-device-pixel-ratio: 2), only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx) {
    .chrome-tabs-optional-shadow-below-bottom-bar {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='2' height='2' viewBox='0 0 2 2'><rect x='0' y='0' width='2' height='1' fill='rgba(0, 0, 0, .27)'></rect></svg>");
    }
  }

  .chrome-tabs .chrome-tab {
    width: 258px
  }
  .chrome-tabs .chrome-tab:nth-child(1) {
    transform: translate3d(0px, 0, 0)
  }
  .chrome-tabs .chrome-tab:nth-child(2) {
    transform: translate3d(239px, 0, 0)
  }

  .ra-webview {
    display: inline-flex;
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 98px);
  }

  body {
    margin: 0;
  }

  .toolbar {
    padding: 0.5em 0.5em;
    background: #fff;
    display: flex;
      
    .controls {
      box-sizing: border-box;
      width: 160px;
      display: flex;
      justify-content: space-between;
      padding: 0 0.5em 0 0.5em;
      text-align: center;
      i {
        color: #444;
        width: 30px;
        height: 30px;
        line-height: 30px;
      }

      svg {
        cursor: pointer;
      }
    }
      
    .url {
      height: 30px;
      background: #f5f5f5;
      border-radius: 6px;
      border: none;
      flex: 1;
      padding: 0 0.5em;
      box-sizing: border-box;
      white-space: nowrap;
      overflow: hidden;
       
      .text {
        outline: none;
        color: #333;
        line-height:30px;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
      }
    }
  }
</style>