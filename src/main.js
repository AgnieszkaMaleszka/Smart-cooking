// main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css'

// globalne style i tokeny
import './styles/base.css'
import './styles/map.css'

const app = createApp(App)
app.use(router)
app.use(createPinia())
app.mount('#app')