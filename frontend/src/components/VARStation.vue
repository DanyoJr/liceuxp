<template>
  <div class="var-layout">
    <div v-if="toastMessage" class="toast-container">
      <div class="toast">
        {{ toastMessage }}
      </div>
    </div>
    <header class="glass-panel header">
      <div class="logo">
        <h1>LiceuXP</h1>
      </div>
      <div class="status-indicator">
        <span class="pulse" :class="connectionStatus"></span>
        {{ connectionStatusText }}
      </div>
    </header>

    <main class="main-content">
      <!-- Lado Esquerdo: Vídeo e Controles -->
      <section class="video-section glass-panel">
        <div class="video-container" :class="{ 'has-video': videoUrl }">
          <video v-if="videoUrl" ref="videoPlayer" :src="videoUrl" controls class="video-element"></video>
          <div v-else class="upload-placeholder" @click="triggerFileInput">
            <span class="upload-icon">📁</span>
            <p>Selecione um vídeo da galeria</p>
            <span class="upload-hint">Formatos suportados: MP4, MOV (Até 20MB)</span>
          </div>
          <input type="file" ref="fileInput" @change="handleFileChange" accept="video/mp4,video/quicktime" class="hidden-input" />
        </div>

        <div class="controls-panel" v-if="videoUrl">
          <h3>1. Selecione a Infração a Investigar:</h3>
          <div class="category-buttons">
            <button 
              v-for="cat in categories" 
              :key="cat.value"
              :class="['btn-category', { active: selectedCategory === cat.value }]"
              @click="selectedCategory = cat.value"
              :disabled="isAnalyzing"
            >
              {{ cat.label }}
            </button>
          </div>

          <button class="btn-analyze" :disabled="!canAnalyze || isAnalyzing" @click="startAnalysis">
            <span v-if="!isAnalyzing">INICIAR ANÁLISE VAR</span>
            <span v-else class="analyzing-text">
              <span class="spinner"></span> ANALISANDO LANCE...
            </span>
          </button>
          
          <button v-if="!isAnalyzing" class="btn-reset" @click="resetSession">Escolher outro vídeo</button>
        </div>
      </section>

      <!-- Lado Direito: Resultados -->
      <section class="result-section glass-panel">
        <h2>Painel de Decisão</h2>
        
        <div v-if="!result && !isAnalyzing" class="empty-state">
          Aguardando submissão do vídeo para análise oficial.
        </div>

        <div v-if="isAnalyzing" class="analyzing-state">
          <div class="radar-spinner"></div>
          <h3>Processamento Ativo...</h3>
          <p>O modelo de IA está extraindo os quadros e avaliando as regras oficiais.</p>
        </div>

        <div v-if="result" class="result-card">
          <div class="decision-badge" :class="'decision-' + (resultData?.decisão?.toLowerCase() || 'inconclusivo')">
            {{ resultData?.decisão || 'N/A' }}
          </div>
          
          <div class="result-group">
            <h4>Justificativa Oficial</h4>
            <p>{{ resultData?.justificativa || 'Nenhuma justificativa fornecida.' }}</p>
          </div>

          <div class="result-group" v-if="resultData?.instantes_relevantes?.length">
            <h4>Instantes Relevantes (Tempo)</h4>
            <div class="tags">
              <span class="tag" v-for="time in resultData.instantes_relevantes" :key="time">⏱ {{ time }}</span>
            </div>
          </div>

          <div class="result-group" v-if="resultData?.limitações?.length">
            <h4>Limitações Visuais da Avaliação</h4>
            <ul class="limitations-list">
              <li v-for="(lim, index) in resultData.limitações" :key="index">{{ lim }}</li>
            </ul>
          </div>
          
          <div class="disclaimer">
            <small>{{ result.observação_geral || 'Análise experimental; não substitui a decisão humana.' }}</small>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const fileInput = ref<HTMLInputElement | null>(null);
const videoPlayer = ref<HTMLVideoElement | null>(null);

const videoFile = ref<File | null>(null);
const videoUrl = ref<string>('');
const selectedCategory = ref<string>('');
const isAnalyzing = ref<boolean>(false);
const result = ref<any>(null);
const toastMessage = ref<string>('');

const categories = [
  { label: 'Impedimento', value: 'impedimento' },
  { label: 'Falta Física', value: 'falta' },
  { label: 'Mão na Bola', value: 'mão_na_bola' }
];

const connectionStatus = ref('online');
const connectionStatusText = computed(() => connectionStatus.value === 'online' ? 'Sistema Pronto' : 'Offline');

const canAnalyze = computed(() => videoFile.value !== null && selectedCategory.value !== '');

const resultData = computed(() => {
  if (!result.value || !selectedCategory.value) return null;
  return result.value[selectedCategory.value];
});

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    if (file.size > 25 * 1024 * 1024) {
      alert('O vídeo é muito grande. Limite de 20MB.');
      return;
    }
    videoFile.value = file;
    videoUrl.value = URL.createObjectURL(file);
    result.value = null;
  }
}

function resetSession() {
  videoFile.value = null;
  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value);
  }
  videoUrl.value = '';
  selectedCategory.value = '';
  result.value = null;
}

async function startAnalysis() {
  if (!canAnalyze.value) return;
  
  isAnalyzing.value = true;
  result.value = null;
  
  const formData = new FormData();
  formData.append('video', videoFile.value as Blob);
  formData.append('category', selectedCategory.value);
  
  try {
    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('SERVER_FULL');
      }
      throw new Error(data.error || 'Erro no servidor');
    }
    
    result.value = data;
    
  } catch (err: any) {
    if (err.message === 'SERVER_FULL' || err.message.includes('lotados')) {
      toastMessage.value = 'Não foi possível seguir porque os servidores estão lotados. Tente novamente mais tarde.';
      setTimeout(() => {
        toastMessage.value = '';
      }, 5000);
    } else {
      alert(`Atenção: ${err.message}`);
    }
  } finally {
    isAnalyzing.value = false;
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.toast {
  background-color: rgba(239, 68, 68, 0.95);
  color: white;
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 18px;
  box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: center;
  max-width: 90vw;
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-40px); }
  to { opacity: 1; transform: translateY(0); }
}

.var-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 32px;
  gap: 32px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 48px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo .icon {
  font-size: 48px;
}

.logo h1 {
  font-size: 48px;
  letter-spacing: 1px;
  background: linear-gradient(90deg, var(--text-main), var(--brand-cyan));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  color: var(--text-muted);
}

.pulse {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--status-no);
  box-shadow: 0 0 10px var(--status-no);
  animation: pulse-anim 2s infinite;
}

@keyframes pulse-anim {
  0% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}

.main-content {
  display: flex;
  flex: 1;
  gap: 32px;
  min-height: 0;
}

.video-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 24px;
}

.result-section {
  flex: 2;
  padding: 32px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.video-container {
  flex: 1;
  background: rgba(0,0,0,0.4);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.video-container.has-video {
  border: 1px solid var(--border-color);
  background: black;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 40px;
  transition: transform 0.2s ease;
}

.upload-placeholder:hover {
  transform: scale(1.05);
}

.upload-icon {
  font-size: 96px;
  margin-bottom: 24px;
}

.upload-hint {
  font-size: 18px;
  color: var(--text-muted);
  margin-top: 8px;
}

.hidden-input {
  display: none;
}

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.controls-panel h3 {
  font-size: 20px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.category-buttons {
  display: flex;
  gap: 8px;
}

.btn-category {
  flex: 1;
  background: rgba(255,255,255,0.05);
  color: var(--text-main);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 20px;
}

.btn-category:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
}

.btn-category.active {
  background: var(--brand-blue);
  border-color: var(--brand-blue);
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.btn-category:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-analyze {
  margin-top: 8px;
  padding: 32px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--brand-blue), var(--brand-cyan));
  color: white;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 1px;
  box-shadow: 0 4px 20px rgba(6, 182, 212, 0.3);
}

.btn-analyze:disabled {
  background: #334155;
  box-shadow: none;
  color: var(--text-muted);
  cursor: not-allowed;
}

.btn-reset {
  background: transparent;
  color: var(--text-muted);
  padding: 16px;
  text-decoration: underline;
  font-size: 20px;
}

.btn-reset:hover {
  color: var(--text-main);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  font-size: 24px;
}

.analyzing-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
}

.radar-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(6, 182, 212, 0.2);
  border-top-color: var(--brand-cyan);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-card {
  animation: slide-up 0.5s ease-out;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.decision-badge {
  padding: 24px;
  text-align: center;
  font-size: 36px;
  font-weight: 800;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.decision-sim {
  background-color: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid var(--status-yes);
}

.decision-não {
  background-color: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid var(--status-no);
}

.decision-inconclusivo {
  background-color: rgba(234, 179, 8, 0.2);
  color: #fde047;
  border: 1px solid var(--status-inc);
}

.result-group h4 {
  color: var(--brand-cyan);
  margin-bottom: 8px;
  font-size: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.result-group p {
  line-height: 1.6;
  font-size: 20px;
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: rgba(255,255,255,0.1);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 16px;
  font-weight: 600;
}

.limitations-list {
  padding-left: 20px;
  color: #cbd5e1;
  font-size: 20px;
  line-height: 1.5;
}

.disclaimer {
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
  color: var(--text-muted);
}
</style>
