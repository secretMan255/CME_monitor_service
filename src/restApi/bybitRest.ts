import axios from 'axios'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'
import { log } from '../commond'
dotenv.config()

export class BybitRestApi {
     private static API_KEY: string = process.env.API_KEY
     private static API_SECRET: string = process.env.API_SECRET
     private static API_URL: string = process.env.API_URL
     private static STOP_LOSS: number = Number(process.env.STOP_LOSS) || 0

     private static getSignature(params: Record<string, any>): string {
          const sortedParams = Object.keys(params)
               .sort()
               .map((key) => `${key}=${params[key]}`)
               .join('&')
          return crypto.createHmac('sha256', this.API_SECRET).update(sortedParams).digest('hex')
     }

     public static async sendRequest(endpoint: string, params: Record<string, any> = {}) {
          if (!this.API_KEY || !this.API_SECRET) {
               throw new Error('Missing API_KEY or API_SECRET')
          }

          params.api_key = this.API_KEY
          params.timestamp = Date.now()
          params.sign = this.getSignature(params)

          try {
               const response = await axios.get(`${this.API_URL}${endpoint}`, { params })
               log(`Response: ${response.data}`)
               return response.data
          } catch (err) {
               log(`Failed to send request:  ${err}`)
          }
     }

     public static async placeMarketOrder(symbol: string, side: 'Buy' | 'Sell', qty: number) {
          const price = await this.getMarketTicker(symbol)
          const entryPrice = price.result[0].last_price

          const stopLoss =
               side === 'Buy'
                    ? (entryPrice * (1 - this.STOP_LOSS / 100)).toFixed(2) // Stop-loss X% below entry
                    : (entryPrice * (1 + this.STOP_LOSS / 100)).toFixed(2)

          return this.sendRequest('/v2/private/order/create', {
               symbol,
               side,
               order_type: 'Market',
               qty,
               stop_lost: stopLoss,
               time_in_force: 'GoodTillCancel',
          })
     }

     public static async getAccountBalance() {
          return this.sendRequest('/v2/private/wallet/balance', { coin: 'USDT' })
     }

     public static async getMarketTicker(symbol: string = 'BTCUSDT') {
          return this.sendRequest('/v2/public/tickers', { symbol })
     }

     public static async getBTCKlineData(interval: string) {
          try {
               const res = await axios.get('https://api.bybit.com/v5/market/kline', {
                    params: {
                         category: 'linear',
                         symbol: 'BTCUSDT',
                         interval: interval,
                    },
               })

               if (res.data?.retCode === 0) {
               }
          } catch (err) {}
     }
}
