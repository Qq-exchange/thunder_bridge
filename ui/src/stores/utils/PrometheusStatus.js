import ForeignStore from '../ForeignStore';

function readPrometheusStatus(resp, field, tokenName, network, name, fallbackValue, formatter) {
  const token = tokenName
    .replace('TT-', '')
    .replace('TW', '')  // TWETH...
  let ret;
  try {
    ret = resp[token][field][network][name]
  } catch (e) {
    ret = fallbackValue
  }
  return formatter(ret)
}

export function ReadPrometheusStatus(resp, tokenName, network, name, fallbackValue, formatter) {
  return readPrometheusStatus(resp, 'status', tokenName, network, name, fallbackValue, formatter)
}

export function ReadPrometheusVStatus(resp, tokenName, network, name, fallbackValue, formatter) {
  return readPrometheusStatus(resp, 'v_status', tokenName, network, name, fallbackValue, formatter)
}

export function ReadValidators(resp, tokenName, network) {
  const validators = ReadPrometheusVStatus(resp, tokenName, network, 'validators', {}, (x)=>x)
  let ret = []
  for(const validator in validators) {
    ret.push(validator)
  }
  return ret
}

export async function LoadPrometheusFile() {
  if (process.env.NODE_ENV === 'development') {
    // return require('/tmp/status.json')
    return
  }
  return (await fetch(process.env.REACT_APP_MONITOR_STATUS_FILE)).json()
}