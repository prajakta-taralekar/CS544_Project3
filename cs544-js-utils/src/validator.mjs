import { AppErrors } from './utils.mjs';

export default function makeValidator(validationSpecs) {
  return new Validator(validationSpecs);
}

class Validator {

  constructor(specs) {
    this._specs = specs;
  }

  validate(cmd, obj={}) {
    const errors = new AppErrors();
    const spec = this._specs[cmd];
    if (!spec) {
      return errors.add(`unknown command ${cmd}`, { code: 'BAD_REQ' });
    }
    else {
      return validate(cmd, spec, obj, errors);
    }
  }
  
}

function validate(cmd, spec, obj, errors) {
  const result = { ...obj };
  const { fields } =  spec;
  if (!fields) {
    const message = 'missing "fields" property in spec';
    return errors.add(message, { code: 'INTERNAL' });
  }
  for (const [id, spec] of Object.entries(fields)) {
    let val = obj[id] ?? undefined;
    let valIsErr = false;
    if (val === undefined) {
      if (spec.required) {
	errors.add(valueError(val, spec?.name ?? id, id));
	valIsErr = true;
      }
      else if (spec?.default) {
	val = (typeof spec.default === 'function')
	  ? spec.default(id)
	  : spec.default;
      }
    }
    if (val !== undefined && !valIsErr) {
      const idVal = checkField(val.toString(), spec, id, obj, errors);
      if (!idVal?.errors) result[id] = idVal;
    }
  }
  return errors.isError() ? errors : result;
}

function checkField(fieldVal, fieldSpec, id, topVal, errors) {
  if (fieldSpec?.chk) {
    if (fieldSpec.chk.constructor === RegExp) {
      const m = fieldVal.match(fieldSpec.chk);
      if (!m || m.index !== 0 || m[0].length !== fieldVal.length) {
	return errors.add(valueError(fieldVal, fieldSpec.name ?? id, id));
      }
    }
    else if (Array.isArray(fieldSpec.chk)) { 
      if (fieldSpec.chk.indexOf(fieldVal) < 0) {
	return errors.add(valueError(fieldVal, fieldSpec.name ?? id, id));
      }
    }
    else if (typeof fieldSpec.chk === 'function') {
      const msg = fieldSpec.chk.call(topVal, fieldVal, fieldSpec, id);
      if (msg) {
	return errors.add(msg, { code: 'BAD_VAL', widget: id });
      }
    }
    else {
      const msg = `bad field chk for field "${id}"`;
      return errors.add(msg, { code: 'INTERNAL', widget: id });
    }
  }
  else if (!SAFE_CHARS_REGEX.test(fieldVal)) {
    return errors.add(valueError(fieldVal, fieldSpec?.name ?? id, id));
  }
  const val = (fieldSpec?.valFn)
	      ? fieldSpec.valFn.call(topVal, fieldVal, fieldSpec, id)
              : fieldVal;
  return val;
}


function valueError(val, name, id) {
  const message = (val !== undefined)
	          ? `bad value "${val}" for ${name}`
           	  : `missing value for ${name}`;
  const code = (val !== undefined) ? 'BAD_VAL' : 'BAD_REQ';
  return { message, options: { code, widget: id } };
}

function valStr(val) { return (val ?? '').toString().trim(); }
    
const SAFE_CHARS_REGEX = /^[\w\s\-\.\@\#\%\$\^\*\(\)\{\}\[\]\:\,\/\'\"\!]*$/;
