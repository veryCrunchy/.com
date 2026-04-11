<script setup lang="ts">
  import Lanyard, {
    type Activity,
    type ActivityData,
    type Emoji,
    type Profile,
    type Timestamps,
  } from "~/src/lanyard";
  const route = useRoute();
  const id = route.params.id as string;
  const currentTime = ref(Date.now());
  const data = ref<ActivityData>();
  const activities = ref<Activity[]>();
  await (await fetch(`https://api.lanyard.rest/v1/users/${id}`))
    .json()
    .then((d: { data: ActivityData }) => {
      if (!d.data) return;
      data.value = d.data;
      activities.value = d.data.activities.filter((a) => a.type !== 4);
    });
  const { data: profile } = await useFetch<{
    user: Profile;
  }>(`https://dcdn.dstn.to/profile/${id}`, {
    server: true,
  });
  let LanyardSocket: globalThis.Ref<WebSocket>;
  let timerInterval: NodeJS.Timeout;

  const showUserCard = useCookie("showUserCard", {
    default: () => true,
  });

  const toggleShowUserCard = () => {
    showUserCard.value = !showUserCard.value;
  };

  onMounted(async () => {
    const lanyard = await Lanyard(id as string);

    LanyardSocket = lanyard.socket;

    watch(lanyard.data, (newData) => {
      if (newData) data.value = newData;
      activities.value = newData?.activities.filter((a) => a.type !== 4);
    });

    timerInterval = setInterval(() => (currentTime.value = Date.now()), 500);
  });

  onBeforeUnmount(() => {
    clearInterval(timerInterval);
    LanyardSocket.value.close();
  });

  const ActivityType: { [key: number]: string } = {
    0: "Playing",
    1: "Streaming",
    2: "Listening to",
    3: "Watching",
    5: "Competing in",
    6: "Right now, I'm -",
  };
  function getActivityType(key: number): string {
    return ActivityType[key] || "";
  }

  const Avatar = computed(() => {
    let avi = "embed/avatars/2.png";
    if (data.value) {
      const { discord_user } = data.value;
      if (data.value?.discord_user.avatar)
        avi = `avatars/${discord_user.id}/${discord_user.avatar}.png`;
    }
    return `https://cdn.discordapp.com/${avi}`;
  });

  const hangText: { [key: string]: string } = {
    eating: "Grubbin",
    gaming: "GAMING",
    chilling: "Chilling",
    focusing: "In the zone",
    brb: "Gonna BRB",
    "in-transit": "Wandering IRL",
    watching: "Watchin' stuff",
  };

  const getAssetImageUrl = (
    applicationId: string | number,
    asset: string | Emoji | undefined
  ) => {
    if (asset && typeof asset !== "string")
      return `https://cdn.discordapp.com/emojis/${asset.id}.${
        asset.animated ? "gif" : "webp"
      }?quality=lossless `;
    if (applicationId === 6) {
      return `/discord/hang/${asset}.svg`;
    }

    if (!asset)
      return `https://dcdn.dstn.to/app-icons/${applicationId}?size=600`;
    if (asset.startsWith("mp:external")) {
      const externalUrl = asset.replace("mp:", "");
      const discordCdnUrl = `https://media.discordapp.net/${externalUrl}`;
      return discordCdnUrl;
    }

    if (asset.startsWith("spotify:")) {
      const externalUrl = asset.replace("spotify:", "");
      const discordCdnUrl = `https://i.scdn.co/image/${externalUrl}`;
      return discordCdnUrl;
    }

    const baseUrl = "https://cdn.discordapp.com/app-assets/";
    const imageUrl = `${baseUrl}${applicationId}/${asset}.png?size=600`;
    return imageUrl;
  };

  onUnmounted(() => {
    clearInterval(timerInterval);
  });

  const formatTime = (time: Date) =>
    `${
      time.getUTCHours()
        ? time.getUTCHours().toString().padStart(2, "0") + ":"
        : ""
    }${time.getUTCMinutes().toString().padStart(2, "0")}:${time
      .getUTCSeconds()
      .toString()
      .padStart(2, "0")}`;
  const getTime = computed(() => (timestamps: Timestamps): string => {
    let { start, end } = timestamps;
    start = Math.round(start / 10) * 10;
    end = Math.round(end / 10) * 10;
    if (currentTime.value <= start) start = currentTime.value;
    if (end <= currentTime.value) end = currentTime.value;

    let elapsedTime = new Date(currentTime.value - start);
    let text = "elapsed";
    if (end) (elapsedTime = new Date(end - currentTime.value)), (text = "left");
    return `${formatTime(elapsedTime)} ${text}`;
  });
  const getTimeProgress = (timestamps?: Timestamps) => {
    if (!timestamps) return null;
    let { start, end } = timestamps;
    if (currentTime.value <= start) start = currentTime.value;
    const elapsedTime = new Date(currentTime.value - start);
    const endTime = new Date(end - start);
    const calc = ((elapsedTime.getTime() / endTime.getTime()) * 10000) / 100;
    return {
      start: formatTime(
        new Date(Math.min(elapsedTime.getTime(), endTime.getTime()))
      ),
      end: formatTime(endTime),
      completion: Math.min(calc, 100),
    };
  };
  const needsMask = computed(
    () => (si: string | undefined) =>
      si
        ? `mask-image: radial-gradient(
                    circle 20px at calc(100% - 12px) calc(100% - 12px),
                    transparent 19px,
                    #000 0
                  );
                  -webkit-mask-image: radial-gradient(
                    circle 20px at calc(100% - 12px) calc(100% - 12px),
                    transparent 19px,
                    #000 0
                  )`
        : ""
  );
</script>

<template>
  <main
    class="flex min-h-screen flex-col items-center justify-center bg-[#171717] bg-gradient-to-br from-[#0d0822]/5 to-[#1a0a2a]/10 text-white"
  >
    <div class="m-5 w-[95vw] max-w-[27.5rem] space-y-5">
      <div
        v-if="showUserCard && data?.discord_user"
        class="bg-primary rounded-md"
      >
        <!--  viewBox="0 0 600 212" -->
        <svg class="rounded-t-md" viewBox="0 0 600 278">
          <mask id="pfp_cutout">
            <rect fill="white" x="0" y="0" width="100%" height="100%"></rect>
            <circle fill="black" cx="82" cy="207" r="68"></circle>
          </mask>
          <mask id="pfp_rounded">
            <rect fill="black" x="0" y="0" width="100%" height="100%"></rect>
            <circle fill="white" cx="82" cy="207" r="62"></circle>
          </mask>

          <foreignObject
            x="0"
            y="0"
            width="100%"
            height="212"
            mask="url(#pfp_cutout)"
            ><div
              class="h-full w-full bg-cover bg-center"
              :style="`
              background-image: url('https://dcdn.dstn.to/banners/${data.discord_user?.id}?size=600');
              background-color: ${profile?.user?.banner_color};
           `"
            >
              <div
                class="absolute right-3 top-3 rounded-full bg-black/30 p-2 transition-colors duration-200 hover:cursor-pointer hover:bg-black/50"
                aria-label="Edit Profile"
                role="button"
                @click="toggleShowUserCard"
              >
                <svg
                  width="24"
                  height="24"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 640 512"
                  ><path
                    d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zm151 118.3C226 97.7 269.5 80 320 80c65.2 0 118.8 29.6 159.9 67.7C518.4 183.5 545 226 558.6 256c-12.6 28-36.6 66.8-70.9 100.9l-53.8-42.2c9.1-17.6 14.2-37.5 14.2-58.7c0-70.7-57.3-128-128-128c-32.2 0-61.7 11.9-84.2 31.5l-46.1-36.1zM394.9 284.2l-81.5-63.9c4.2-8.5 6.6-18.2 6.6-28.3c0-5.5-.7-10.9-2-16c.7 0 1.3 0 2 0c44.2 0 80 35.8 80 80c0 9.9-1.8 19.4-5.1 28.2zm51.3 163.3l-41.9-33C378.8 425.4 350.7 432 320 432c-65.2 0-118.8-29.6-159.9-67.7C121.6 328.5 95 286 81.4 256c8.3-18.4 21.5-41.5 39.4-64.8L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5zm-88-69.3L302 334c-23.5-5.4-43.1-21.2-53.7-42.3l-56.1-44.2c-.2 2.8-.3 5.6-.3 8.5c0 70.7 57.3 128 128 128c13.3 0 26.1-2 38.2-5.8z"
                /></svg>
              </div>
            </div>
          </foreignObject>
          <text
            x="155"
            y="240"
            class="font-poppins select-none font-semibold"
            font-size="20"
            fill="white"
          >
            {{ data.discord_user.global_name ?? data.discord_user.username }}
          </text>
          <text
            x="155"
            y="260"
            class="font-poppins select-none text-sm font-normal"
            font-size="20"
            fill="gray"
          >
            {{ data.discord_user.username }}
          </text>

          <image
            mask="url(#pfp_rounded)"
            :href="Avatar"
            :x="19.5"
            :y="144.5"
            width="125"
            height="125"
          ></image>
        </svg>
      </div>
      <div
        class="ml-auto w-fit rounded-full bg-primary p-2 transition-colors duration-200 hover:cursor-pointer hover:bg-black/50"
        aria-label="Edit Profile"
        role="button"
        v-if="!showUserCard"
        @click="toggleShowUserCard"
      >
        <svg
          width="20"
          height="20"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 512"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
            <path
              d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"
            />
          </svg>
        </svg>
      </div>
      <div v-if="activities?.length" class="space-y-5 rounded-md bg-primary p-5">
        <div v-for="activity in activities" :key="activity.id">
          <div class="font-poppins items-center text-gray-200">
            <h1
              class="mb-1 h-[1.3rem] truncate text-sm leading-5 font-bold uppercase max-sm:hidden"
              :title="activity.name"
            >
              {{ getActivityType(activity.type) }} {{ activity.name }}
            </h1>
            <div class="flex items-center max-sm:text-sm">
              <div class="size-20 sm:size-25 relative">
                <NuxtImg
                  :title="activity.assets?.large_text"
                  svg="true"
                  width="100"
                  height="100"
                  :src="
                    getAssetImageUrl(
                      activity.application_id ?? activity.type,
                      activity.assets?.large_image ??
                        activity.assets?.small_image ??
                        activity.emoji ??
                        activity.state
                    )
                  "
                  :style="needsMask(activity.assets?.small_image)"
                  class="rounded-md size-20 sm:size-25 object-cover"
                >
                </NuxtImg>

                <NuxtImg
                  :title="activity.assets?.small_text"
                  width="25"
                  height="25"
                  v-if="activity.assets?.small_image"
                  :src="
                    getAssetImageUrl(
                      activity.application_id,
                      activity.assets?.small_image
                    )
                  "
                  class="size-8 rounded-full absolute -right-1 -bottom-1"
                ></NuxtImg>
              </div>
              <div
                class="my-auto ml-2.5 w-[calc(100%_-_5.6rem)] space-y-[0.05rem] sm:ml-5 sm:w-[calc(100%_-_7.5rem)]"
              >
                <h1
                  class="h-[1.3rem] truncate leading-5 font-semibold max-sm:hidden"
                  :title="activity.name"
                >
                  {{ getActivityType(activity.type) }}
                  {{ activity.type == 6 ? null : activity.name }}
                </h1>
                <p
                  v-if="activity.details"
                  :title="activity.details"
                  class="h-[1.3rem] truncate leading-5"
                >
                  {{ activity.details }}
                </p>
                <p
                  v-if="
                    activity.state &&
                    (activity.type !== 6 || activity.state !== 'custom')
                  "
                  :title="activity.state"
                  class="h-[1.3rem] truncate leading-5"
                >
                  {{
                    activity.type == 6
                      ? hangText[activity.state]
                      : activity.state
                  }}
                </p>
                <div v-if="activity.timestamps" class="h-fit">
                  <div
                    v-if="activity.timestamps.start && activity.timestamps.end"
                  >
                    <div class="mt-1 h-1 w-full rounded-md bg-secondary">
                      <div
                        :style="`width: ${
                          getTimeProgress(activity.timestamps)?.completion
                        }%`"
                        class="h-full rounded-md bg-gray-200 transition-[width] duration-500 ease-linear"
                      ></div>
                    </div>
                    <div class="flex h-[1.05rem] justify-between space-x-1 text-sm">
                      <p>
                        {{ getTimeProgress(activity.timestamps)?.start }}
                      </p>
                      <p>
                        {{ getTimeProgress(activity.timestamps)?.end }}
                      </p>
                    </div>
                  </div>
                  <div v-else>
                    <p class="h-[1.3rem] truncate leading-5">
                      {{ getTime(activity.timestamps) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activity.buttons && false" class="space-y-2 mt-4">
              <div
                v-for="button in activity.buttons"
                class="flex h-8 min-w-20 items-center justify-center rounded-md bg-secondary px-4 text-dim text-nowrap"
              >
                {{ button }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
