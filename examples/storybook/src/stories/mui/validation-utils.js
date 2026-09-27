import * as yup from 'yup';

export const requiredAlphanumericDashUnderscoreSpace = yup
  .string()
  .matches(/^[a-zA-Z0-9 _-]+$/, 'Only alpha-numeric, dash(-) and underscore(_) allowed.')
  .required();

export const requiredString = yup.string().required();

export function makeValidator(schema) {
  return (text) => {
    try {
      schema.validateSync(text);
      return { valid: true };
    } catch (ex) {
      return { valid: false, message: ex.message };
    }
  };
}
