// store-y Pinia
// trzymamy stan (dane), logike biznesową aplikacji Vue
// przechowujemy dane współdzileone przez wiele komponentów, 
// metody zmiany stanu 
// gettery (obliczanie  np sumy produktów w koszyku)
import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', {
  // stan 
  state: () => ({
    products: []
  }),
  // akcje - metody zmieniające stan 
  actions: {
    addProduct(product) {
      this.products.push(product)
    }
  }
  // Tu są gettery — obliczenia na stanie
  // getters: {
  //  itemCount: (state) => state.items.length
  // }
})
