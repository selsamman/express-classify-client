import {serialize, deserialize} from "js-freeze-dry";
import axios from "axios";
import {io, Socket} from "socket.io-client";

export const value : unknown = undefined;

export class ExpressClient {

    logLevel: Partial<typeof EndPointsLogging> = {};
    listener: ((data: any) => void) | undefined;
    socket : Socket | undefined = undefined;

    log: (message: string) => void = msg => console.log(msg);

    setLogger(log : (message: string) => void) {
        this.log = log;
    }

    setLogLevel(logLevel : Partial<typeof EndPointsLogging>) {
        this.logLevel = logLevel;
    }

    setListener( listener : (data: any) => void) {
        this.listener = listener;
    }

    async initSocket (urlPrefix : string) {
        await axios.post(`/${urlPrefix}`, {json: {}});
        this.socket = io();
        await new Promise (resolve => {
            this.socket && this.socket.on("connect", () => {
                this.log(`Connected to socket ${this.socket ? this.socket.id : ''}`);
                resolve(true);// x8WIv7-mJelg7on_ALbx
            });
        })
    }

    async createResponse<T>(urlPrefix : string, client : T, classes : any = {}) {

        if (!this.socket)
            await this.initSocket(urlPrefix);


        for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(client))) {

            const endPoint = `/${urlPrefix}.${methodName}`;

            if (methodName === 'constructor' || typeof (client as any)[methodName] !== 'function')
                continue;

            if (this.socket) {
                this.log(`creating endpoint for ${endPoint}`);
                this.socket.on(endPoint, (data : any) => {
                    const methodName = endPoint.split(".")[1];
                    const args = deserialize(data, classes).args;
                    if (this.logLevel.data)
                        this.log(`Endpoint ${endPoint} reached with ${data}`);
                    else if (this.logLevel.calls)
                        this.log(`Endpoint ${endPoint} reached`);

                    (client as any)[methodName].apply(client, args);
                });
            }

        }
    }

    createRequest<T>(urlPrefix : string, client : T, classes : any = {}) {

        for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(client))) {

            if (methodName === 'constructor' || typeof (client as any)[methodName] !== 'function')
                continue;

            (client as any)[methodName] =  async (...args : any) => {

                try {

                    // Gather endpoint and data
                    const endPoint = `/${urlPrefix}.${methodName}`;
                    const payload = serialize({args}, classes);

                    // Log request
                    if (this.logLevel.data)
                        this.log(`Endpoint ${endPoint} requesting with ${payload}`);
                    else if (this.logLevel.calls)
                        this.log(`Endpoint ${endPoint} requesting`);

                    // Make requests and parse response

                    const response = await axios.post(endPoint, {json: payload});
                    let ret = deserialize(response.data.json, classes);

                    // Log response
                    if (this.logLevel.data)
                        this.log(`Endpoint ${endPoint} responded with ${response.data.json}`);
                    else if (this.logLevel.calls)
                        this.log(`Endpoint ${endPoint} responded ${ret.exception ? 'with exception' : 'successfully'}`);

                    // Handle exceptions
                    if (ret.exception)
                        throw new Error(ret.exception);

                    // Pass side-data to listener
                    if (ret.listenerContent && this.listener)
                        this.listener(ret.listenerContent);

                    return ret.response;

                // Catch any exception so it can be logged and then rethrown
                } catch (e: any) {

                    if (this.logLevel.exceptions)
                        this.log(e.message as string);
                    throw e;
                }
            }
        }
        return client;
    }
}
export const EndPointsLogging = {
    create : true,
    exceptions : true,
    calls : true,
    data : true,
}
