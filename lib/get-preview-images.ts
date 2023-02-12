import crypto from 'crypto'
import got from 'got'
import pMap from 'p-map'

import { api, isPreviewImageSupportEnabled } from './config'
import * as db from './db'
import * as types from './types'

function sha256(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function getPreviewImages(
  images: string[]
): Promise<types.PreviewImageMap> {
  if (!isPreviewImageSupportEnabled) {
    return {}
  }

  const imageDocRefs = images.map((url) => {
   
    const id = sha256(url)
    // console.log(url,id,"\n")
    return db.images.doc(id)
  })
  // console.log("进入PreviewImage\t",imageDocRefs.length)
  if (!imageDocRefs.length) {
    return {}
  }

  const imageDocs = await db.db.getAll(...imageDocRefs)
  // console.log("getAll\n")
  const results = await pMap(imageDocs, async (model, index) => {
    if (model.exists) {
      return model.data() as types.PreviewImage
    } else {
      const json = {
        url: images[index],
        id: model.id
      }
      console.log('createPreviewImage server-side', json)
      // TODO: should we fire and forget here to speed up builds?
      return got
        .post(api.createPreviewImage, { json })
        .json() as Promise<types.PreviewImage>
    }
  })
  // console.log("结束\n")
  return results
    .filter(Boolean)
    .filter((image) => !image.error)
    .reduce(
      (acc, result) => ({
        ...acc,
        [result.url]: result
      }),
      {}
    )
}
