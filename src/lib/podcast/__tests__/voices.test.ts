import { isSoloScript, speakerCount, voiceForRole, voiceMapFor } from '../voices'

describe('speaker count and voice assignment', () => {
  it('defaults to two speakers and treats only an explicit 1 as solo', () => {
    expect(speakerCount(undefined)).toBe(2)
    expect(speakerCount({})).toBe(2)
    expect(speakerCount({ speakers: 1 })).toBe(1)
  })

  it('assigns voices by role, not by line position', () => {
    const voices = voiceMapFor({ voice_id_1: 'A', voice_id_2: 'B' })
    const roles = ['host', 'host', 'guest', 'guest', 'host']
    expect(roles.map(role => voiceForRole(role, voices))).toEqual(['A', 'A', 'B', 'B', 'A'])
    expect(voiceForRole(undefined, voices)).toBe('A')
  })

  it('routes every line to the first voice for a solo episode', () => {
    const voices = voiceMapFor({ speakers: 1, voice_id_1: 'A', voice_id_2: 'B' })
    expect(voices).toEqual({ host: 'A', guest: 'A' })
  })

  it('detects solo scripts from the roles alone', () => {
    expect(isSoloScript([{ role: 'host' }, { role: 'host' }])).toBe(true)
    expect(isSoloScript([{ role: 'host' }, { role: 'guest' }])).toBe(false)
    expect(isSoloScript([])).toBe(false)
  })
})
