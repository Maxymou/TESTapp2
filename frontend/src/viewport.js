const setViewportVars = () => {
  const root = document.documentElement;
  const visualViewport = window.visualViewport;
  const height = window.innerHeight;
  const width = window.innerWidth;
  const visualHeight = visualViewport?.height || height;
  const visualWidth = visualViewport?.width || width;

  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--app-width', `${width}px`);
  root.style.setProperty('--vvh', `${visualHeight}px`);
  root.style.setProperty('--vvw', `${visualWidth}px`);
  root.style.setProperty('--safe-top', 'env(safe-area-inset-top, 0px)');
  root.style.setProperty('--safe-right', 'env(safe-area-inset-right, 0px)');
  root.style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom, 0px)');
  root.style.setProperty('--safe-left', 'env(safe-area-inset-left, 0px)');
};

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const initViewport = () => {
  setViewportVars();
  window.addEventListener('resize', setViewportVars, { passive: true });
  window.addEventListener('orientationchange', setViewportVars, { passive: true });
  window.visualViewport?.addEventListener('resize', setViewportVars, { passive: true });
  window.visualViewport?.addEventListener('scroll', setViewportVars, { passive: true });
};

export const getViewportInfo = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
  appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  visualViewport: window.visualViewport
    ? {
        width: Math.round(window.visualViewport.width),
        height: Math.round(window.visualViewport.height),
        offsetTop: Math.round(window.visualViewport.offsetTop),
        offsetLeft: Math.round(window.visualViewport.offsetLeft)
      }
    : null,
  standalone: isStandalone()
});
