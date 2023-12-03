type Result_Ok<T> = {
  ok: true;
  value: T;
};

type Result_Err = {
  ok: false;
  error: Error;
};

export type Result<T> = Result_Ok<T> | Result_Err;
