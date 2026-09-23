import { MetadataRoute } from 'next'
import siteMetadata from '@/data/siteMetadata'
import { fallbackLng, secondLng } from '@/i18n/locales'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteMetadata.siteUrl, lastModified: new Date() }]
}
