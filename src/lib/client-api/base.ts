'use client'
import axios, {AxiosRequestConfig} from "axios";
import Router from 'next/router'
import {toast} from "sonner";

axios.interceptors.response.use(function (response) {
  // Any status code that lie within the range of 2xx cause this function to trigger
  // Do something with response data
  return response;
}, function (error) {
  // Any status codes that falls outside the range of 2xx cause this function to trigger
  // Do something with response error
  // console.log('axios error', error)
  toast.error(error.response?.data?.error || error.response?.data?.message || error.message || 'Network Error')
  const resp = error.response
  console.log('apiRequest', resp.status)
  if (resp.status === 401) {
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
