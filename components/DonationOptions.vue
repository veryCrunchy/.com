<script setup lang="ts">
	import { ref, onMounted, onBeforeUnmount } from "vue";
	import { gsap } from "gsap";

	const donations = [
		{
			name: "Ko-Fi",
			description:
				"Make quick, one-time contributions and leave a message of support. Perfect for small, meaningful gestures.",
			icon: "☕",
			url: "https://ko-fi.com/verycrunchy",
			color: "#29abe0 ",
		},
		{
			name: "GitHub Sponsors",
			description:
				"Support me monthly with GitHub's matched contributions. 100% of your money goes directly to me, and you can leave a message.",
			icon: "⭐",
			url: "https://github.com/sponsors/verycrunchy",
			color: "#ea4aaa",
		},
		{
			name: "Stripe",
			description:
				"Use professional-grade payment processing and leave a message with your contribution. Best for larger contributions.",
			icon: "💳",
			url: "https://buy.stripe.com/00gcO34iX4KpdfG001",
			color: "#635bff",
		},
	];

	const moveLargeCursor = (e: MouseEvent) => {
		const bigCursor = document.getElementById("cursorLarge");
		if (bigCursor) {
			(bigCursor.style.left = `${e.clientX}px`),
				(bigCursor.style.top = `${e.clientY}px`);
		}
	};

	onMounted(() => {
		const cards = document.querySelectorAll(".donation-card");
		window.addEventListener("mousemove", moveLargeCursor);
		cards.forEach((card) => {
			card.addEventListener("mouseenter", onCardEnter);
			card.addEventListener("mouseleave", onCardLeave);
		});
	});

	onBeforeUnmount(() => {
		document.addEventListener("mousemove", moveLargeCursor);

		const cards = document.querySelectorAll(".donation-card");
		cards.forEach((card) => {
			card.removeEventListener("mouseenter", onCardEnter);
			card.removeEventListener("mouseleave", onCardLeave);
		});
	});

	function onCardEnter(e: Event) {
		const smallCursor = document.getElementById("cursorSmall"),
			bigCursor = document.getElementById("cursorLarge");

		if (smallCursor && bigCursor) {
			bigCursor.style.display = "block";
			smallCursor.style.display = "none";

			// Get computed dimensions from the big cursor element
			const bigStyles = window.getComputedStyle(bigCursor);
			smallCursor.style.width = bigStyles.width;
			smallCursor.style.height = bigStyles.height;
		}
	}

	function onCardLeave(e: Event) {
		const smallCursor = document.getElementById("cursorSmall"),
			bigCursor = document.getElementById("cursorLarge");

		if (bigCursor) bigCursor.style.display = "none";
		if (smallCursor) {
			smallCursor.style.display = "block";
			// Remove inline sizing so it reverts to its original size/animation
			smallCursor.style.width = "";
			smallCursor.style.height = "";
		}
	}
</script>

<template>
	<div class="flex flex-col gap-12 w-full max-w-4xl">
		<h2 class="text-center text-4xl">Support My Work or Hobbies :3</h2>
		<div
			class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-center">
			<a
				v-for="option in donations"
				:key="option.name"
				:href="option.url"
				target="_blank"
				rel="noopener"
				hs-dist="100"
				class="hover donation-card group">
				<div
					class="flex flex-col items-center gap-3 p-8 border-1 border-op-20 transition-all duration-300">
					<div class="flex items-center justify-center gap-4">
						<span class="text-3xl donation-icon">{{
							option.icon
						}}</span>
						<h3 class="text-xl">
							{{ option.name }}
						</h3>
					</div>
					<p class="text-sm op-80 text-center">
						{{ option.description }}
					</p>
				</div>
			</a>
		</div>
	</div>
	<div id="cursorLarge" class="largeCursor">
		<img
			src="/hand.svg"
			alt="Large cursor hand"
			class="pointer-events-none select-none"
			draggable="false"
			width="20"
			height="20"
			decoding="async"
			loading="lazy" />
	</div>
</template>

<style scoped>
	.largeCursor {
		display: none;
		pointer-events: none;
		position: fixed;
		left: 0;
		top: 0;
		z-index: 9998;
		width: 30px;
		height: 30px;
		filter: brightness(1.5);
		/* image is fat */
		transform: translate(-50%, -200%);
	}

	.donation-card {
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 1rem;
		backdrop-filter: blur(10px);
		background: linear-gradient(
			135deg,
			rgba(34, 15, 78, 0.01),
			rgba(96, 36, 145, 0.01)
		);
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
	}

	.donation-card:hover {
		transform: translateY(-6px);
		transition: all 0.4s ease;
		box-shadow: 0 0 20px var(--primary), 0 0 2px var(--primary);
		cursor: none;
	}

	.donation-icon {
		filter: drop-shadow(0 0 10px var(--primary));
	}

	.donation-card:hover .donation-icon {
		animation: float 2s ease-in-out infinite, glow 1.5s alternate infinite;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-5px);
		}
	}

	@keyframes glow {
		from {
			filter: drop-shadow(0 0 10px var(--primary));
		}
		to {
			filter: drop-shadow(0 0 20px var(--primary));
		}
	}

	.stripe-buy-button-container {
		text-align: center;
	}

	stripe-buy-button {
		margin-top: 1rem;
		width: 100%;
	}
</style>
