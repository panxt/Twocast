import axios, { AxiosRequestConfig } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export interface AxiosInstanceOptions {
    proxy?: AxiosRequestConfig["proxy"] | string;
    throwError?: boolean;
}

// proxyConfig: 可选，支持 axios 代理配置对象或代理 URL 字符串
// 如果为字符串，则自动用 https-proxy-agent 创建 agent，只设置 agent，不设置 proxy
// 如果为对象，则只设置 proxy，不设置 agent
export function getAxiosInstance(options?: AxiosInstanceOptions) {
    const defaultOptions: AxiosInstanceOptions = {
        throwError: false,
    }
    options = { ...defaultOptions, ...options }
    // 60s was too tight for long-text/file jobs once Minimax M-series appends
    // a <think> reasoning block: a 5K-char input can balloon to 30s+ of
    // upstream thinking before the JSON arrives. 180s still has a hard
    // ceiling so a stuck request can't hang the worker forever.
    const timeout = 180_000
    let axiosOptions: AxiosRequestConfig = {
        // validateStatus 返回 true 时，promise 状态为 resolved，否则为 rejected
        validateStatus: function (status) {
            // 只要有响应（status 存在），都不抛出异常
            return options?.throwError ? status == 200 : true;
        },
        timeout: timeout,
    };
    if (typeof options?.proxy === 'string') {
        // 代理 URL 字符串方式，只设置 agent
        const url = new URL(options.proxy);
        let agent: any
        if (url.protocol.startsWith('http')) {
            agent = new HttpsProxyAgent(options.proxy);
        } else if (url.protocol.startsWith('socks')) {
            agent = new SocksProxyAgent(options.proxy);
        }
        if (agent) {
            axiosOptions.httpAgent = agent;
            axiosOptions.httpsAgent = agent;
        }
        // 注意：此时不要设置 proxy 选项，否则会和 agent 冲突
    } else if (options?.proxy) {
        // 对象方式，只设置 proxy
        axiosOptions.proxy = options.proxy;
        // 不设置 agent
    }
    const instance = axios.create(axiosOptions);
    return instance;
}