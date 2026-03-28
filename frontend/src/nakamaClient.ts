import { Client } from "@heroiclabs/nakama-js"

const client = new Client(
  "defaultkey",    
  "127.0.0.1",     
  "7350",        
  false      
)

export default client