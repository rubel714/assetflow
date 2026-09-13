import { assetImageSrc } from "./assetImage";
import { getActingOrganization, getSavedUser, isActingAsOrganization, isSiteAdmin } from "./globalfunction";

const DEFAULT_SELECTOR = 'link[data-default-favicon]';
const DYNAMIC_ATTR = "data-dynamic-favicon";

function removeDynamicIcons() {
  document.querySelectorAll(`link[${DYNAMIC_ATTR}]`).forEach((el) => el.remove());
}

function setDefaultIconsEnabled(enabled) {
  document.querySelectorAll(DEFAULT_SELECTOR).forEach((el) => {
    el.media = enabled ? "all" : "not all";
  });
}

export function applyFavicon(href) {
  removeDynamicIcons();
  if (!href) {
    setDefaultIconsEnabled(true);
    return;
  }
  setDefaultIconsEnabled(false);
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = href;
  icon.setAttribute(DYNAMIC_ATTR, "true");
  document.head.appendChild(icon);
  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = href;
  apple.setAttribute(DYNAMIC_ATTR, "true");
  document.head.appendChild(apple);
}

export function resolveFaviconHref() {
  const user = getSavedUser();
  if (!user) return "";
  if (isSiteAdmin(user) && !isActingAsOrganization(user)) return "";
  const acting = getActingOrganization();
  const logo = acting?.LogoUrl || user?.OrganizationLogoUrl;
  return logo ? assetImageSrc(logo) : "";
}

export function syncFavicon() {
  applyFavicon(resolveFaviconHref());
}
