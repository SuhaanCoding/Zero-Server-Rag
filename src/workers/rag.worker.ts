declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', (event) => {
    const { type, payload } = event.data;

    console.log(`worker recieved a message of: ${type} type` );
    
    switch (type){

        case 'TEST_CONN':
            console.log(`A connection has been established here`);
            break;
        
        case 'Data_Process':
            if ((typeof payload) === `string`) {
            const result = payload.toUpperCase();

            self.postMessage({type :`RESULT`, payload: result})
            }
            else { break; }

            break;


        
        break;

        
    }


}


)
