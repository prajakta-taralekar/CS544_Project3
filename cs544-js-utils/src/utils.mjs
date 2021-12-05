export class AppErrors {
  constructor() {
    this.errors = [];
  }

  add(...args) {
    console.assert(args.length === 1 || args.length === 2);
    let message, options;
    if (args.length === 2) {
      [ message, options ] = args; 
      this.errors.push({message, options});
    }
    else if (Array.isArray(args[0])) {
      args[0].forEach(err => this.add(err));
    }
    else if (args[0].errors) {
      this.add(args[0].errors);
    }
    else {
      ({ message, options } = args[0]);
      if (!message) message = args[0].toString();
      if (!options) options = {};  
      this.errors.push({message, options});
    }
    return this;
  }

  isError() { return this.errors.length > 0; }
  
  toString() { return this.errors.map(e => e.message).join('\n'); }
}

