'use client'
import axios, {AxiosRequestConfig} from "axios";
import {toast} from "sonner";

axios.interceptors.response.use(function (response) {
  // Any status code that lie within the range of 2xx cause this function to trigger
  // Do something with response data
  return response;
}, function (error) {
  // Any status codes that falls outside the range of 2xx cause this function to trigger
  // Do something with response error
  // console.log('axios error', error)
  const message = error.response?.status === 413
    ? '上传请求超过服务上限；文档须在 4 MB 以内，封面须在 3 MB 以内，请压缩或拆分后重试'
    : error.response?.status === 504
      ? '服务器处理超时，请刷新节目库确认是否已创建；仍失败时请拆分资料后重试'
      : error.response?.data?.error || error.response?.data?.message || error.message || '网络请求失败，请检查连接后重试'
  toast.error(message)
  const resp = error.response
  if (resp?.status === 401) {
    // Router.push('/sign-in')
  }
  return Promise.reject(error);
});

export async function apiRequest(config: AxiosRequestConfig) {
  const resp = await axios.request(config)
  return resp
}

export async function checkResponse(response: Response) {

}
