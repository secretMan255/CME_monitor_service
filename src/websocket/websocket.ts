import { log } from '../commond'
import WebSocket from 'ws'
import * as dotenv from 'dotenv'
import { EMA, RSI } from 'technicalindicators'
import { BybitRestApi } from '../restApi/bybitRest'

dotenv.config()

enum TradeDecision {
     BUY = 'Buy',
     SELL = 'Sell',
}

export class WebSocketService {
     private static publicWs: WebSocket | null = null
     private static symbol: string = process.env.SYMBOL || 'BTCUSDT'
     private static publicUrl: string = 'wss://stream.bybit.com/v5/public/linear'
     public static btcPrices: number[] = []

     public static initPublic() {
          log('Initializing Public WebSocket')

          this.publicWs = new WebSocket(this.publicUrl)

          this.publicWs.on('open', () => {
               log('Public WebSocket connected')
               this.subscribeToBTCPrice()
          })

          this.publicWs.on('message', async (data) => {
               const parsedData = JSON.parse(data.toString())
               const price: number = Number(parsedData.data?.lastPrice)

               if (parsedData.topic === 'tickers.BTCUSDT' && price) {
                    log(`BTC Price: ${price} USDT`)

                    this.btcPrices.push(price)
                    if (this.btcPrices.length > 50) this.btcPrices.shift()

                    if (this.btcPrices.length >= 14) {
                         const decision = await this.tradeStrategy()

                         if (decision === TradeDecision.BUY) {
                              await BybitRestApi.placeMarketOrder(this.symbol, TradeDecision.BUY, 0.01)
                         }
                         if (decision === TradeDecision.SELL) {
                              await BybitRestApi.placeMarketOrder(this.symbol, TradeDecision.SELL, 0.01)
                         }
                    }
               }
          })

          this.publicWs.on('close', () => log('Public WebSocket disconnected'))
          this.publicWs.on('error', (err) => log(`Public WebSocket Error: ${err.message}`))
     }

     private static subscribeToBTCPrice() {
          if (!this.publicWs) return
          const subscribe = { op: 'subscribe', args: ['tickers.BTCUSDT'] }
          this.publicWs.send(JSON.stringify(subscribe))
          log('Subscribed to BTC price updates')
     }

     public static async tradeStrategy(): Promise<TradeDecision | null> {
          if (this.btcPrices.length < 14) return null

          const closePrices: number[] = this.btcPrices.slice(-50)
          const ema50: number[] = EMA.calculate({ period: 50, values: closePrices })
          const rsi14: number[] = RSI.calculate({ period: 14, values: closePrices })

          const lastPrice: number = closePrices[closePrices.length - 1]
          const lastEMA: number = ema50[ema50.length - 1]
          const lastRSI: number = rsi14[rsi14.length - 1]

          log(`EMA: ${lastEMA}, RSI: ${lastRSI}`)

          if (lastPrice > lastEMA && lastRSI < 30) {
               log('Signal: BUY')
               return TradeDecision.BUY
          } else if (lastPrice < lastEMA && lastRSI > 70) {
               log('Signal: SELL')
               return TradeDecision.SELL
          }

          return null
     }

     public static closeConnections() {
          if (this.publicWs) {
               log('Closing Public WebSocket...')
               this.publicWs.close()
               this.publicWs = null
          }
     }
}
