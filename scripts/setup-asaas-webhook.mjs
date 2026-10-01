import process from "node:process";

const apiKey=process.env.ASAAS_API_KEY;
const authToken=process.env.ASAAS_WEBHOOK_TOKEN;
const appUrl=process.env.NEXT_PUBLIC_APP_URL;
const env=process.env.ASAAS_ENV==="production"?"production":"sandbox";

if(!apiKey||!authToken||!appUrl){
  console.error("Defina ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN e NEXT_PUBLIC_APP_URL.");
  process.exit(1);
}

if(authToken.length<32){
  console.error("ASAAS_WEBHOOK_TOKEN precisa ter ao menos 32 caracteres.");
  process.exit(1);
}

const base=env==="production"?"https://api.asaas.com/v3":"https://api-sandbox.asaas.com/v3";
const url=appUrl.replace(/\/$/,"")+"/api/webhooks/asaas";

const response=await fetch(base+"/webhooks",{
  method:"POST",
  headers:{
    "content-type":"application/json",
    "user-agent":"RifaTrack/1.0",
    "access_token":apiKey,
  },
  body:JSON.stringify([{
    name:"RifaTrack Pix",
    url,
    email:"",
    enabled:true,
    interrupted:false,
    apiVersion:3,
    authToken,
    sendType:"SEQUENTIALLY",
    events:[
      "PAYMENT_RECEIVED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_REFUNDED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE"
    ]
  }])
});

const body=await response.text();
if(!response.ok){
  console.error("Falha ao criar webhook:",response.status,body);
  process.exit(1);
}
console.log("Webhook configurado:",body);
