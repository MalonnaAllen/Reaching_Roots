CREATE TABLE user_unavailability (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  unavailable_date DATE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_unavailability (user_id, unavailable_date),
  KEY idx_user_unavailability_user (user_id),
  CONSTRAINT fk_user_unavailability_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO user_unavailability (user_id, unavailable_date)
SELECT id, UNAVAILABLE
FROM users
WHERE UNAVAILABLE IS NOT NULL;
