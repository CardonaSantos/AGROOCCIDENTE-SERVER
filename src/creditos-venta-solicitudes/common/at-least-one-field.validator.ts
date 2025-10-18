// common/validators/at-least-one-field.validator.ts
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function AtLeastOneField(
  propertyNames: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'AtLeastOneField',
      target: object.constructor,
      propertyName,
      constraints: [propertyNames],
      options: validationOptions,
      validator: {
        validate(_: any, args: ValidationArguments) {
          const [props] = args.constraints as [string[]];
          return props.some(
            (p) => object[p] !== undefined && object[p] !== null,
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [props] = args.constraints as [string[]];
          return `Debe enviarse al menos uno de: ${props.join(', ')}`;
        },
      },
    });
  };
}
