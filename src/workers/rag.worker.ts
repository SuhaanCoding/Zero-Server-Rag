declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    console.log(`worker received a message of: ${type} type` );
    
    switch (type){

        case 'TEST_CONN':
            console.log(`A connection has been established here`);
            break;
        
        case 'Data_Process':
            if ((typeof payload) === `string`) {
            const result = payload.toUpperCase();

            self.postMessage({type :`RESULT`, payload: result})
            }
            break;
        
        default:
            console.error(`A command has been receieved with ${type} and not certain what it is`)
            self.postMessage({type: `error`, payload: {type}})
        
    }


}


)
