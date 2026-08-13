from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Base commune : autorise la construction depuis un objet ORM
    (`from_attributes`), utilisée par tous les schémas qui reflètent
    directement un modèle SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)
