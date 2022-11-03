/**
 * Type checker functions inspired by React.PropTypes.
 */
import {Model} from '../Model';

export declare interface TypeCheckFunc {
    (value: any, name: string): null;
    isRequired: TypeCheckFunc;

    // For recursive reference
    load?: (value: any) => any;
    ref?: typeof Model;
}

/**
 * createTypeChecker generates a simple type checker.
 * This function is ONLY used internally,
 * and users can use the generated type checker functions.
 *
 * @param {string} typename the name of expected type
 *                represented by "typeof" function.
 * @param {function} validate the validator function for this typename.
 * @return {TypeCheckFunc}
 */
const createTypeChecker = (
    typename: string,
    validate: (value) => boolean,
): TypeCheckFunc => {
  /**
   * checkType is the base framework function of validation.
   * @param {boolean} required specifies if this property is required OR NOT.
   * @param {any} value the actual value of this property.
   * @param {string} name the name of this property inside the Model.
   * @return {null}
   */
  const checkType = (required, value, name): null => {
    if (typeof value === 'undefined') {
      if (required) {
        throw new Error(`${name} is marked as required`);
      } else {
        return null;
      }
    }
    if (!validate(value)) {
      throw new Error(`${name} is not ${typename}`);
    }
    return null;
  };

  /**
   * This `checker` is the actual function users can use.
   * Users can switch `required` OR NOT just by accessing `.isRequired` property
   * of this generated function.
   */
  const checker = checkType.bind(null, false);
  checker.isRequired = checkType.bind(null, true);
  return checker;
};

/**
 * arrayTypeChecker is a generator function of type checker
 * with checking each element of the array by provided checkFunc.
 * If the provided TypeCheckFunc for the elements is `reference` checker,
 * this generated TypeCheckFunc has `decode` function
 * which can decode each element to Model class.
 *
 * @param {TypeCheckFunc} checkValue TypeCheckFunc
 *                        for each element of this array
 * @return {TypeCheckFunc}
 */
const arrayValueTypeChecker = (checkValue: TypeCheckFunc): TypeCheckFunc => {
  const checkRoot = (required, rootValue, rootName): void => {
    if (typeof rootValue === 'undefined') {
      if (required) {
        throw new Error(`${rootName} is marked as required`);
      } else {
        return;
      }
    }
    if (!Array.isArray(rootValue)) {
      throw new Error(`${rootName} is not an array`);
    }
    for (let i = 0; i < rootValue.length; i++) {
      checkValue(rootValue[i], `element[${i}] of ${rootValue}`);
    }
  };
  const check: TypeCheckFunc = checkRoot.bind(null, false);
  check.isRequired = checkRoot.bind(null, true);
  // To decode this property as a Model, store the constructor here.
  if (typeof checkValue.ref === 'function') {
    check.ref = checkValue.ref;
    check.load = (
        rawArrayOfObject = [],
    ) => rawArrayOfObject.map(checkValue.load);
  }
  return check;
};

/**
 * ReferenceTypeOption can specify the options of reference type.
 */
export interface ReferenceTypeOption {
    /**
     * eager:
     *  If it's true, methods like `find` will try to load
     *  the newest data for the referenced models.
     *  Otherwise the referenced models will be just decoded class instances
     *  stored under this parent's namespace.
     */
    eager?: boolean;
}

/**
 * referenceTypeChecker is a generator function of type checker
 * with referencing another Model, known as "relations".
 * The generated type checker function also includes "decode" function
 * so that the referenced peoperties can be decoded
 * at the same time on decoding the root model.
 *
 * @param {function} refConstructor
 * @param {ReferenceTypeOption} opt
 * @return {TypeCheckFunc}
 */
const referenceTypeChecker = (
    refConstructor: typeof Model,
    opt: ReferenceTypeOption = {},
): TypeCheckFunc => {
  const checkRoot = (
      required: boolean,
      value: Model,
      refName: string,
  ): null => {
    if (typeof value === 'undefined') {
      if (required) {
        throw new Error(`${refName} is marked as required`);
      } else {
        return null;
      }
    }
    value._validate();
    return null;
  };
  const check = checkRoot.bind(null, false);
  check.isRequired = checkRoot.bind(null, true);
  // To decode this property as a Model, store the constructor here.
  check.ref = refConstructor;
  check.load = (rawObject) => {
    if (!opt.eager) {
      // eslint-disable-next-line new-cap
      return new check.ref(rawObject);
    }
    if (!rawObject) {
      return;
    }
    if (typeof rawObject._id === 'undefined') {
      return;
    }
    return check.ref.find(rawObject._id);
  };
  return check;
};

/**
 * shapeTypeChecker is a generator function of type checker
 * with checking each element of the object.
 *
 * @param {Record<string, TypeCheckFunc>} validations is a dictionary
 *        to map which TypeCheckFunc is used to which property.
 * @return {TypeCheckFunc}
 */
const shapeTypeChecker = (
    validations: { [key: string]: TypeCheckFunc } = {},
): TypeCheckFunc => {
  const checkRoot = (required, rootValue, rootName): null => {
    if (typeof rootValue === 'undefined') {
      if (required) {
        throw new Error(`${rootName} is marked as required`);
      } else {
        return null;
      }
    }
    Object.keys(validations).map((fieldName) => {
      const validation = validations[fieldName];
      const value = rootValue[fieldName];
      validation(value, fieldName);
    });
    return null;
  };
  const check = checkRoot.bind(null, false);
  check.isRequired = checkRoot.bind(null, true);
  return check;
};

/**
 * dictTypeChecker is a generagor function of type checker
 * with assuming the value is a dictionary object of given type.
 *
 * @param {TypeCheckFunc} checkValue
 * @return {TypeCheckFunc}
 */
const dictTypeChecker = (checkValue: TypeCheckFunc): TypeCheckFunc => {
  const checkRoot = (required, rootValue, rootName): void => {
    if (typeof rootValue === 'undefined') {
      if (required) {
        throw new Error(`${rootName} is marked as required but undefined`);
      }
      return;
    }
    if (rootValue.constructor !== Object) {
      throw new Error(
          `${rootName} is supposed to be a dictionary` +
          `but ${rootValue.constructor.name}`,
      );
    }
    Object.keys(rootValue).map((key) => {
      checkValue(rootValue[key], `${rootName}[${key}]`);
    });
    return;
  };
  const check: TypeCheckFunc = checkRoot.bind(null, false);
  check.isRequired = checkRoot.bind(null, true);
  if (typeof checkValue.ref === 'function') {
    check.ref = checkValue.ref;
    check.load = (raw = {}) => Object.keys(raw).reduce((prev, key) => {
      if (checkValue.load) prev[key] = checkValue.load(raw[key]);
      return prev;
    }, {});
  }
  return check;
};

const createDateTypeChecker = (): TypeCheckFunc => {
  const checkType = (required: boolean, value: any, name: string): null => {
    if (typeof value === 'undefined') {
      if (required) {
        throw new Error(`${name} is marked as required, but got undefined`);
      }
      return null;
    }
    if (
      typeof value.constructor === 'function' &&
      value.constructor.name === 'Date'
    ) {
      return null;
    }
    throw new Error(
        `${name} is supposed to be Date, but got ${value.constructor.name}`,
    );
  };
  const check = checkType.bind(null, false);
  check.isRequired = checkType.bind(null, true);
  check.load = (raw) => new Date(raw);
  return check;
};

export const Types = {
  // Simple type checkers
  array: createTypeChecker('array', (value) => Array.isArray(value)),
  bool: createTypeChecker('bool', (value) => typeof value === 'boolean'),
  number: createTypeChecker('number', (value) => typeof value === 'number'),
  object: createTypeChecker('object', (value) => typeof value === 'object'),
  string: createTypeChecker('string', (value) => typeof value === 'string'),

  // Decodable type cheker
  date: createDateTypeChecker(),

  // Recursive type checker generators
  arrayOf: arrayValueTypeChecker,
  dictOf: dictTypeChecker,
  reference: referenceTypeChecker,
  shape: shapeTypeChecker,
};
