import { isValidFolderPath } from '../folder'

describe('folder path rule shared by PATCH and gen-podcast', () => {
  it('accepts the root and nested folders', () => {
    expect(isValidFolderPath('/')).toBe(true)
    expect(isValidFolderPath('/财务/对账/')).toBe(true)
  })

  it('rejects paths that are not wrapped in slashes, are empty-segmented or contain control characters', () => {
    expect(isValidFolderPath('财务/')).toBe(false)
    expect(isValidFolderPath('/财务')).toBe(false)
    expect(isValidFolderPath('/财务//对账/')).toBe(false)
    expect(isValidFolderPath('/a\\b/')).toBe(false)
    expect(isValidFolderPath('/a\u0001b/')).toBe(false)
    expect(isValidFolderPath(`/${'长'.repeat(41)}/`)).toBe(false)
    expect(isValidFolderPath(42)).toBe(false)
  })
})
