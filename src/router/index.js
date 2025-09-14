// routing widoków 
import { createRouter, createWebHistory } from 'vue-router'
import { useRouter } from 'vue-router'

import Home from '../views/Home.vue'
import Filter from '../views/Filter.vue'
import Prices from '../views/Prices.vue'
import SmartShopping from '../views/SmartShopping.vue'


const routes = [
  { path: '/', component: Home },
  { path: '/filter', component: Filter },
  { path: '/prices', component: Prices },
  { path: '/shopping-list', component : SmartShopping}
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
