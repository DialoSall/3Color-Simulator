import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDailyDate } from "../hooks/useDailyDate.js";
import { getMetadataTags, getRouteMetadata } from "../seo/metadata.js";

function RouteMetadata() {
  const { pathname, search } = useLocation();
  const today = useDailyDate();
  useEffect(() => {
    const metadata = getRouteMetadata(pathname + search, today);
    document.head.querySelectorAll("[data-seo]").forEach(element => element.remove());
    for (const { tag, key, text, attributes = {} } of getMetadataTags(metadata)) {
      const element = document.createElement(tag);
      element.setAttribute("data-seo", key);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      if (text) element.textContent = text;
      document.head.appendChild(element);
    }
  }, [pathname, search, today]);
  return null;
}

export default RouteMetadata;
