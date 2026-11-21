import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { useStoredState } from '../../layout/useStoredState'
import { DecodeMode, type DecodeState } from './DecodeMode'
import { EncodeMode, type EncodeState } from './EncodeMode'
import { algKind, importKey, isAlg, sign, type Alg, type ParsedToken } from './jwt'
import { pretty } from './util'
import './JwtTool.css'

type Mode = 'decode' | 'encode'

// At least 32 bytes, so the example doesn't trip the short-secret warning.
const EXAMPLE_SECRET = 'selamat-pagi-demo-secret-for-this-token'

function initialEncode(alg: Alg): EncodeState {
  const now = Math.floor(Date.now() / 1000)
  return {
    alg,
    header: pretty({ alg, typ: 'JWT' }),
    payload: pretty({ sub: '1234567890', name: 'Budi Santoso', role: 'admin', iat: now, exp: now + 3600 }),
    secret: EXAMPLE_SECRET,
    base64: false,
    privateKey: '',
    pair: null,
  }
}

export default function JwtTool() {
  const [mode, setMode] = useStoredState<Mode>('jwt:mode', 'decode')
  const [savedAlg, setSavedAlg] = useStoredState<string>('jwt:alg', 'HS256')
  const [decode, setDecode] = useState<DecodeState>({ token: '', key: '', base64: false })
  const [encode, setEncode] = useState<EncodeState>(() => initialEncode(isAlg(savedAlg) ? savedAlg : 'HS256'))

  function updateDecode(patch: Partial<DecodeState>) {
    setDecode((d) => ({ ...d, ...patch }))
  }

  function updateEncode(patch: Partial<EncodeState>) {
    if (patch.alg) setSavedAlg(patch.alg)
    setEncode((e) => ({ ...e, ...patch }))
  }

  async function showExample() {
    const now = Math.floor(Date.now() / 1000)
    const key = await importKey('HS256', 'sign', EXAMPLE_SECRET)
    if (!key.ok) return
    const token = await sign(
      'HS256',
      { alg: 'HS256', typ: 'JWT' },
      { sub: '1234567890', name: 'Budi Santoso', role: 'admin', iat: now - 20 * 60, exp: now + 40 * 60 },
      key.key,
    )
    setDecode({ token, key: EXAMPLE_SECRET, base64: false })
  }

  // Encode → Decode: the new token, with the key that verifies it.
  function decodeToken(token: string) {
    const kind = algKind(encode.alg)
    const publicKey = encode.pair?.privateKey === encode.privateKey ? encode.pair.publicKey : null
    const key = kind === 'hmac' ? encode.secret : kind === 'none' ? '' : (publicKey ?? encode.privateKey)
    setDecode({ token, key, base64: kind === 'hmac' && encode.base64 })
    setMode('decode')
  }

  // Decode → Encode: the same header and payload, ready to change and sign again.
  function editToken(token: ParsedToken) {
    const alg = isAlg(token.header.alg) ? token.header.alg : encode.alg
    const kind = algKind(alg)
    updateEncode({
      alg,
      header: pretty({ ...token.header, alg }),
      payload: token.payload === null ? encode.payload : pretty(token.payload),
      ...(kind === 'hmac' && decode.key !== '' ? { secret: decode.key, base64: decode.base64 } : {}),
    })
    setMode('encode')
  }

  return (
    <div className="jwt-tool">
      <div className="jwt-modes" role="group" aria-label="Mode">
        {(
          [
            ['decode', 'Decode', 'search'],
            ['encode', 'Encode & sign', 'code'],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            className="jwt-mode"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            <Icon name={icon} size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Both stay mounted, so switching modes keeps what you typed in each. */}
      <div hidden={mode !== 'decode'}>
        <DecodeMode state={decode} update={updateDecode} onExample={() => void showExample()} onEdit={editToken} />
      </div>
      <div hidden={mode !== 'encode'}>
        <EncodeMode state={encode} update={updateEncode} onDecode={decodeToken} />
      </div>
    </div>
  )
}
