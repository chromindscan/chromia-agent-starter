import {
  ChromiaDB,
  clientUrl,
  blockchainIid,
  signatureProvider,
} from "../agent/services/chromia";
import { createApp, ref, onMounted, nextTick, onUnmounted } from "vue";
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';

const BrainSection = {
  props: ["title", "icon", "isActive", "onClick"],
  template: `
    <div 
      @click="onClick"
      :class="[
        'relative overflow-hidden h-full rounded-xl',
        'bg-black/30 backdrop-blur-lg',
        'border border-transparent',
        isActive ? 'scale-100 shadow-glow' : 'scale-95 hover:scale-98 cursor-pointer hover:shadow-glow-soft'
      ]"
      :style="{
        'box-shadow': isActive 
          ? '0 0 30px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.2)' 
          : ''
      }"
    >
      <div class="absolute inset-0 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-purple-500/5">
        <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 animate-pulse"></div>
      </div>
      <div class="absolute inset-0 backdrop-blur-sm bg-gradient-to-br from-white/5 to-white/10"></div>
      <div class="relative h-full p-6">
        <h2 class="text-2xl font-bold mb-6 flex items-center gap-3">
          <span class="text-cyan-400 animate-pulse w-8 h-8 flex items-center justify-center">
            {{ icon }}
          </span>
          <span class="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            {{ title }}
          </span>
        </h2>
        <div class="relative flex-1 overflow-y-auto custom-scrollbar">
          <div class="space-y-4">
            <slot></slot>
          </div>
        </div>
      </div>
      <div 
        :class="[
          'absolute inset-0 opacity-0 transition-opacity duration-300',
          'bg-gradient-to-r from-cyan-500/5 to-purple-500/5',
          'hover:opacity-100'
        ]"
      ></div>
    </div>
  `,
};

const App = {
  components: { BrainSection },
  setup() {
    const STATE = {
      logs: ref([]),
      shortTermMemory: ref([]),
      longTermMemory: ref(""),
      isLoading: ref(false),
      error: ref(null),
      activeSection: ref(null),
      isInitialLoad: ref(true)
    };

    let vantaEffect = null;
    let pollingInterval = null;

    async function initializeDatabase() {
      const db = new ChromiaDB({ clientUrl, blockchainIid, signatureProvider });
      await db.init();
      return db;
    }

    async function fetchMemoryData(sessionId) {
      try {
        if (STATE.isInitialLoad.value) {
          STATE.isLoading.value = true;
        }
        
        const db = await initializeDatabase();
        const [memoryLong, memoryShort, memoryLogs] = await Promise.all([
          db.getLongTermMemory(sessionId),
          db.getLatestShortTermMemories(sessionId),
          db.getLogs(sessionId),
        ]);

        updateStateIfChanged(memoryLogs, memoryShort, memoryLong);
        STATE.isInitialLoad.value = false;
      } catch (e) {
        STATE.error.value = `Failed to fetch memory data: ${e.message}`;
        console.error("Memory fetch error:", e);
      } finally {
        STATE.isLoading.value = false;
      }
    }

    function updateStateIfChanged(memoryLogs, memoryShort, memoryLong) {
      if (JSON.stringify(STATE.logs.value) !== JSON.stringify(memoryLogs)) {
        STATE.logs.value = memoryLogs;
      }
      if (JSON.stringify(STATE.shortTermMemory.value) !== JSON.stringify(memoryShort)) {
        STATE.shortTermMemory.value = memoryShort;
      }
      if (STATE.longTermMemory.value !== memoryLong) {
        STATE.longTermMemory.value = memoryLong;
      }
    }

    function setActiveSection(section) {
      STATE.activeSection.value = STATE.activeSection.value === section ? null : section;
    }

    function startPolling(sessionId) {
      fetchMemoryData(sessionId);
      pollingInterval = setInterval(() => fetchMemoryData(sessionId), 1000);
    }

    function stopPolling() {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }

    function initializeVantaEffect() {
      const element = document.querySelector("#background-animation");
      if (element) {
        vantaEffect = NET({
          el: element,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          scale: 1.00,
          scaleMobile: 1.00,
          color: 0x00ffff,
          backgroundColor: 0x0,
          points: 15.00,
          maxDistance: 25.00,
          spacing: 17.00,
          showDots: false
        });
      }
    }

    function timeAgo(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const seconds = Math.floor((now - date) / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      if (seconds > 0) return `${seconds}s ago`;
      return 'just now';
    }

    function getOrPromptSessionId() {
      const urlSessionId = new URLSearchParams(window.location.search).get("sessionId");
      if (urlSessionId) return urlSessionId;

      const userInput = prompt(
        "Please enter your session ID:",
        ""
      );

      if (!userInput) {
        throw new Error("Session ID is required to continue");
      }

      const newUrl = new URL(window.location);
      newUrl.searchParams.set("sessionId", userInput);
      window.history.pushState({}, '', newUrl);

      return userInput;
    }

    onMounted(() => {
      nextTick(() => initializeVantaEffect());
      try {
        const sessionId = getOrPromptSessionId();
        startPolling(sessionId);
      } catch (error) {
        STATE.error.value = error.message;
      }
      return () => { if (vantaEffect) vantaEffect.destroy(); };
    });

    onUnmounted(() => {
      stopPolling();
      if (vantaEffect) vantaEffect.destroy();
    });

    return {
      ...STATE,
      setActiveSection,
      timeAgo,
    };
  },
  template: `
    <div class="min-h-screen bg-black text-white p-4 font-mono relative overflow-hidden">
      <div id="background-animation" class="fixed inset-0 -z-10"></div>
      <h1 class="text-4xl font-bold mb-8 text-center text-cyan-400 animate-pulse relative z-10">
        <span class="absolute -inset-1 blur-sm bg-cyan-500/20"></span>
        <span class="relative">Neural Interface: AI Brain Explorer</span>
      </h1>
      <div v-if="error" 
        class="fixed top-4 right-4 bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-lg backdrop-blur-sm z-20">
        {{ error }}
      </div>
      <div v-if="isLoading" 
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="text-cyan-400 text-2xl animate-pulse flex items-center gap-2">
          <span class="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
          Accessing Neural Network...
        </div>
      </div>
      <div :class="[
        'grid gap-6 transition-all duration-500 relative z-10',
        activeSection ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
      ]">
        <div :class="[
          'transition-all duration-500',
          activeSection && activeSection !== 'logs' ? 'hidden' : 'block',
          'h-[calc(100vh-6rem)]'
        ]">
          <BrainSection 
            title="Neural Activity Logs" 
            icon="🧠" 
            :isActive="activeSection === 'logs'"
            @click="() => setActiveSection('logs')"
          >
            <div class="h-full overflow-y-auto space-y-4 px-2">
              <div v-for="(log, index) in logs" :key="index" 
                class="bg-black/40 rounded-lg border border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
              >
                <div class="p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-1 bg-cyan-500/10 rounded text-cyan-400 text-sm font-medium">
                      {{log.model}}
                    </span>
                    <span class="text-xs text-gray-400">
                      {{ timeAgo(log.created_at) }}
                    </span>
                  </div>
                  
                  <div class="space-y-2">
                    <div class="bg-green-500/5 rounded-md p-3">
                      <p class="text-sm text-green-400 font-medium mb-1">Input</p>
                      <p class="text-gray-300">{{ log.user_question }}</p>
                    </div>
                    
                    <div class="bg-cyan-500/5 rounded-md p-3">
                      <p class="text-sm text-cyan-400 font-medium mb-1">Response</p> 
                      <p class="text-gray-300">{{log.assistant_reply}}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BrainSection>
        </div>
        <div :class="[
          'transition-all duration-500',
          activeSection && activeSection !== 'shortTerm' ? 'hidden' : 'block',
          'h-[calc(100vh-6rem)]'
        ]">
          <BrainSection 
            title="Synaptic Buffer (Short-Term)" 
            icon="💾" 
            :isActive="activeSection === 'shortTerm'"
            @click="() => setActiveSection('shortTerm')"
          >
            <div class="h-full overflow-y-auto">
              <div v-for="(item, index) in shortTermMemory" :key="index" 
                class="mb-2 p-3 bg-black/40 rounded border border-purple-500/10 hover:border-purple-500/30 transition-colors">
                <span :class="['font-bold', item.role === 'user' ? 'text-yellow-400' : 'text-purple-400']">
                  {{ item.role }}:
                </span>
                <span class="ml-2 text-gray-300">{{ item.content }}</span>
              </div>
            </div>
          </BrainSection>
        </div>

        <div :class="[
          'transition-all duration-500',
          activeSection && activeSection !== 'longTerm' ? 'hidden' : 'block',
          'h-[calc(100vh-6rem)]'
        ]">
          <BrainSection 
            title="Neural Archive (Long-Term)" 
            icon="📀" 
            :isActive="activeSection === 'longTerm'"
            @click="() => setActiveSection('longTerm')"
          >
            <div class="h-full overflow-y-auto">
              <div class="whitespace-pre-wrap p-4 bg-black/40 rounded border border-cyan-500/10 text-gray-300">
                {{ longTermMemory }}
              </div>
            </div>
          </BrainSection>
        </div>
      </div>
    </div>
  `,
};

// Create and mount the app
createApp(App).mount("#app");
