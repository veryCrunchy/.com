<script setup lang="ts">
  import Lanyard, {
    type Activity,
    type ActivityData,
    type Timestamps,
  } from "~/src/lanyard";
  const route = useRoute();
  const currentTime = ref(Date.now());

  const activities = ref<Activity[]>();
  let LanyardSocket: globalThis.Ref<WebSocket>;
  let timerInterval: NodeJS.Timeout;
  onMounted(async () => {
    const lanyard = await Lanyard(route.params.id as string);

    LanyardSocket = lanyard.socket;

    watch(
      lanyard.activities,
      (newActivities) => (activities.value = newActivities)
    );

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
  };
  function getActivityType(key: number): string {
    return ActivityType[key] || "";
  }
  function getAssetImageUrl(applicationId: string, asset: string | undefined) {
    if (applicationId === "disconnected") return "/disconnect-plug-icon.png";
    if (!asset) return `https://dcdn.dstn.to/app-icons/${applicationId}`;
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
    const imageUrl = `${baseUrl}${applicationId}/${asset}.png`;
    return imageUrl;
  }

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
    const { start, end } = timestamps;

    let elapsedTime = new Date(currentTime.value - start);
    let text = "elapsed";
    if (end) (elapsedTime = new Date(end - currentTime.value)), (text = "left");
    return `${formatTime(elapsedTime)} ${text}`;
  });
  const getTimeProgress = (timestamps?: Timestamps) => {
    if (!timestamps) return null;
    const { start, end } = timestamps;
    const elapsedTime = new Date(currentTime.value - start);
    const endTime = new Date(end - start);
    const calc = ((elapsedTime.getTime() / endTime.getTime()) * 10000) / 100;

    console.log(calc);
    return {
      start: formatTime(
        new Date(Math.min(elapsedTime.getTime(), endTime.getTime()))
      ),
      end: formatTime(endTime),
      completion: Math.min(calc, 100),
    };
  };
  const needsMask = (si: string | undefined) =>
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
                  );`
      : "";
</script>

<template>
  <main
    class="text-white bg-#171717 flex flex-col justify-center items-center h-screen bg-gradient-to-br from-#0d0822/5 to-#1a0a2a/10"
  >
    <div v-if="activities" class="space-y-5 bg-primary rounded-md p-5 m-5">
      <div
        v-for="activity in activities.filter((a) => a.type !== 4)"
        :key="activity.id"
      >
        <div class="text-gray-200 font-[poppins] items-center">
          <h1 class="text-sm uppercase font-bold mb-1 sm:hidden truncate h-5.2 leading-5" :title="activity.name">
            {{ getActivityType(activity.type) }} {{ activity.name }}
          </h1>
          <div class="flex items-center lt-sm:text-sm w-80vw max-w-100">
            <div class="size-20 sm:size-25 relative">
              <NuxtImg
                :title="activity.assets?.large_text"
                svg="true"
                width="100"
                height="100"
                :src="
                  getAssetImageUrl(
                    activity.application_id,
                    activity.assets?.large_image ?? activity.assets?.small_image
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
            <div class="space-y-.2 ml2.5 sm:ml5 w-[calc(100%_-_5.6rem)] sm:w-[calc(100%_-_7.50rem)] my-a">
              <h1
                class="font-semibold lt-sm:hidden truncate h-5.2 leading-5"
                :title="activity.name"
              >
                {{ getActivityType(activity.type) }} {{ activity.name }}
              </h1>
              <p
                v-if="activity.details"
                :title="activity.details"
                class="truncate h-5.2 leading-5"
              >
                {{ activity.details }}
              </p>
              <p
                v-if="activity.state"
                :title="activity.state"
                class="truncate h-5.2 leading-5"
              >
                {{ activity.state }}
              </p>
              <div v-if="activity.timestamps" class="h-fit">
                <div
                  v-if="activity.timestamps.start && activity.timestamps.end"
                >
                  <div class="w-full rounded-md h-1 mt1 bg-secondary">
                    <div
                      :style="`width: ${
                        getTimeProgress(activity.timestamps)?.completion
                      }%`"
                      class="h-full transition-width transition-ease-linear transition-width-500 rounded-md bg-gray-200"
                    ></div>
                  </div>
                  <div class="text-sm space-x-1 h-4.2 flex justify-between">
                    <p>
                      {{ getTimeProgress(activity.timestamps)?.start }}
                    </p>
                    <p>
                      {{ getTimeProgress(activity.timestamps)?.end }}
                    </p>
                  </div>
                </div>
                <div v-else>
                  <p class="truncate h-5.2 leading-5">
                    {{ getTime(activity.timestamps) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-if="activity.buttons && false" class="space-y-2 mt-4">
            <div
              v-for="button in activity.buttons"
              class="bg-secondary text-nowrap text-dim px4 h-8 rounded-md min-w-20 flex justify-center items-center"
            >
              {{ button }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
