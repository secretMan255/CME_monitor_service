import { WebSocketService } from './websocket/websocket'
import { BybitRestApi } from './restApi/bybitRest'

export class service {
     public static async init() {
          WebSocketService.initPublic()
          this.start()
     }

     public static async start() {}

     public static async TerminateService() {
          WebSocketService.closeConnections()
     }
}
