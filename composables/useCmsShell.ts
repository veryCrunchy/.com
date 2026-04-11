import {
  DEFAULT_CMS_SITE_SETTINGS,
  type CmsHomePayload,
} from "~/types/directus";

const DEFAULT_CMS_HOME_PAYLOAD: CmsHomePayload = {
  site: DEFAULT_CMS_SITE_SETTINGS,
  recentPosts: [],
  recentPhotos: [],
};

export function useCmsShell() {
  return useAsyncData<CmsHomePayload>(
    "cms-shell",
    () => $fetch("/api/cms/home"),
    {
      default: () => DEFAULT_CMS_HOME_PAYLOAD,
      server: true,
      lazy: false,
    }
  );
}
